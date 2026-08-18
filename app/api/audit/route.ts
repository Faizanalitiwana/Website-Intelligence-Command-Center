import { NextRequest, NextResponse } from "next/server";

type AuditIssue = {
  severity: "high" | "medium" | "low";
  code: string;
  title: string;
  detail: string;
  url: string;
};

type PageResult = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  title: string;
  metaDescription: string;
  h1Count: number;
  canonical: string;
  robots: string;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  issues: AuditIssue[];
};

type AuditData = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  score: number;
  pagesScanned: number;
  pages: PageResult[];
  issues: AuditIssue[];
  summary: {
    high: number;
    medium: number;
    low: number;
    missingTitle: number;
    missingDescription: number;
    missingH1: number;
    missingCanonical: number;
  };
};

const DEFAULT_MAX_PAGES = 100;
const MAX_ALLOWED_PAGES = 100;
const FETCH_TIMEOUT_MS = 15000;

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1].trim()) : "";
}

function getTitle(html: string): string {
  return firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
}

function getMeta(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (
    firstMatch(
      html,
      new RegExp(
        `<meta\\b[^>]*\\bname=["']${escaped}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`,
        "i"
      )
    ) ||
    firstMatch(
      html,
      new RegExp(
        `<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bname=["']${escaped}["'][^>]*>`,
        "i"
      )
    )
  );
}

function getCanonical(html: string): string {
  return (
    firstMatch(
      html,
      /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i
    ) ||
    firstMatch(
      html,
      /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i
    )
  );
}

function countTags(html: string, tag: string): number {
  return html.match(new RegExp(`<${tag}\\b`, "gi"))?.length ?? 0;
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractLinks(
  html: string,
  baseUrl: URL,
  rootOrigin: string
): string[] {
  const links = new Set<string>();
  const regex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1]?.trim();

    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);

      if (!isHttpUrl(url.toString()) || url.origin !== rootOrigin) {
        continue;
      }

      links.add(normalizeUrl(url.toString()));
    } catch {
      // Ignore malformed links.
    }
  }

  return [...links];
}

function extractSitemapLocations(xml: string, baseUrl: URL): string[] {
  const locations = new Set<string>();
  const regex = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    const raw = stripHtml(match[1] ?? "").trim();
    if (!raw) continue;

    try {
      const url = new URL(raw, baseUrl);
      if (!isHttpUrl(url.toString())) continue;
      locations.add(normalizeUrl(url.toString()));
    } catch {
      // Ignore malformed sitemap locations.
    }
  }

  return [...locations];
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex\b/i.test(xml);
}

function scoreIssues(issues: AuditIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === "high") return total + 20;
    if (issue.severity === "medium") return total + 12;
    return total + 6;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

async function fetchText(
  url: string,
  accept: string
): Promise<{ response: Response; text: string }> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: {
      "User-Agent": "ToolNest-Website-Intelligence/1.0",
      Accept: accept,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const text = await response.text();
  return { response, text };
}

async function discoverSitemapUrls(
  rootUrl: string,
  rootOrigin: string
): Promise<string[]> {
  const root = new URL(rootUrl);
  const sitemapCandidates = new Set<string>([
    new URL("/sitemap.xml", root).toString(),
    new URL("/sitemap_index.xml", root).toString(),
  ]);

  try {
    const robotsUrl = new URL("/robots.txt", root).toString();
    const { response, text } = await fetchText(
      robotsUrl,
      "text/plain,text/*;q=0.9,*/*;q=0.1"
    );

    if (response.ok) {
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*sitemap\s*:\s*(\S+)\s*$/i);
        if (!match?.[1]) continue;

        try {
          const sitemapUrl = new URL(match[1], root);
          if (sitemapUrl.origin === rootOrigin) {
            sitemapCandidates.add(normalizeUrl(sitemapUrl.toString()));
          }
        } catch {
          // Ignore malformed robots sitemap URLs.
        }
      }
    }
  } catch {
    // robots.txt is optional.
  }

  const discoveredPages = new Set<string>();
  const sitemapQueue = [...sitemapCandidates];
  const visitedSitemaps = new Set<string>();

  while (sitemapQueue.length > 0 && visitedSitemaps.size < 10) {
    const sitemapUrl = sitemapQueue.shift();
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue;

    visitedSitemaps.add(sitemapUrl);

    try {
      const { response, text } = await fetchText(
        sitemapUrl,
        "application/xml,text/xml,text/plain,*/*;q=0.1"
      );

      if (!response.ok || !text) continue;

      const locations = extractSitemapLocations(
        text,
        new URL(sitemapUrl)
      );

      if (isSitemapIndex(text)) {
        for (const location of locations) {
          const locationUrl = new URL(location);
          if (
            locationUrl.origin === rootOrigin &&
            !visitedSitemaps.has(location)
          ) {
            sitemapQueue.push(location);
          }
        }
      } else {
        for (const location of locations) {
          const locationUrl = new URL(location);
          if (locationUrl.origin === rootOrigin) {
            discoveredPages.add(location);
          }
        }
      }
    } catch {
      // Sitemap discovery is an enhancement; normal link crawling continues.
    }
  }

  return [...discoveredPages];
}

function buildPageResult(
  url: string,
  response: Response,
  html: string,
  finalUrl: string,
  rootOrigin: string
): { page: PageResult; links: string[] } {
  const contentType = response.headers.get("content-type") ?? "";
  const title = stripHtml(getTitle(html));
  const metaDescription = getMeta(html, "description");
  const canonical = getCanonical(html);
  const robots = getMeta(html, "robots");
  const h1Count = countTags(html, "h1");
  const text = stripHtml(html);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const base = new URL(finalUrl);
  const allLinks = extractLinks(html, base, rootOrigin);

  let externalLinks = 0;
  const linkRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1]?.trim();
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      const link = new URL(href, base);
      if (
        (link.protocol === "http:" || link.protocol === "https:") &&
        link.origin !== rootOrigin
      ) {
        externalLinks++;
      }
    } catch {
      // Ignore malformed links.
    }
  }

  const issues: AuditIssue[] = [];

  if (response.status >= 400) {
    issues.push({
      severity: "high",
      code: "HTTP_ERROR",
      title: "HTTP error detected",
      detail: `The page returned HTTP status ${response.status}.`,
      url,
    });
  }

  if (!title) {
    issues.push({
      severity: "high",
      code: "MISSING_TITLE",
      title: "Missing page title",
      detail: "This page does not contain an HTML title.",
      url,
    });
  } else if (title.length < 30) {
    issues.push({
      severity: "low",
      code: "SHORT_TITLE",
      title: "Short page title",
      detail: "The page title is shorter than the commonly recommended range.",
      url,
    });
  } else if (title.length > 60) {
    issues.push({
      severity: "low",
      code: "LONG_TITLE",
      title: "Long page title",
      detail: "The page title is longer than the commonly recommended range.",
      url,
    });
  }

  if (!metaDescription) {
    issues.push({
      severity: "medium",
      code: "MISSING_META_DESCRIPTION",
      title: "Missing meta description",
      detail: "This page does not contain a meta description.",
      url,
    });
  }

  if (h1Count === 0) {
    issues.push({
      severity: "medium",
      code: "MISSING_H1",
      title: "Missing H1 heading",
      detail: "This page does not contain an H1 heading.",
      url,
    });
  } else if (h1Count > 1) {
    issues.push({
      severity: "low",
      code: "MULTIPLE_H1",
      title: "Multiple H1 headings",
      detail: `The page contains ${h1Count} H1 headings.`,
      url,
    });
  }

  if (!canonical) {
    issues.push({
      severity: "low",
      code: "MISSING_CANONICAL",
      title: "Missing canonical URL",
      detail: "This page does not declare a canonical URL.",
      url,
    });
  }

  if (robots.toLowerCase().includes("noindex")) {
    issues.push({
      severity: "high",
      code: "NOINDEX_DETECTED",
      title: "Noindex detected",
      detail: "The robots meta tag contains noindex.",
      url,
    });
  }

  if (wordCount < 300) {
    issues.push({
      severity: "low",
      code: "LOW_WORD_COUNT",
      title: "Low visible word count",
      detail: `The page contains approximately ${wordCount} visible words.`,
      url,
    });
  }

  return {
    page: {
      url,
      finalUrl,
      status: response.status,
      contentType,
      title,
      metaDescription,
      h1Count,
      canonical,
      robots,
      wordCount,
      internalLinks: allLinks.length,
      externalLinks,
      issues,
    },
    links: allLinks,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      url?: unknown;
      maxPages?: unknown;
    };

    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: "Website URL is required." },
        { status: 400 }
      );
    }

    let target: URL;

    try {
      target = new URL(rawUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: "Please enter a valid website URL." },
        { status: 400 }
      );
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.json(
        {
          success: false,
          error: "Only HTTP and HTTPS URLs are supported.",
        },
        { status: 400 }
      );
    }

    const requestedMax =
      typeof body.maxPages === "number" && Number.isFinite(body.maxPages)
        ? Math.floor(body.maxPages)
        : DEFAULT_MAX_PAGES;

    const maxPages = Math.max(
      1,
      Math.min(requestedMax, MAX_ALLOWED_PAGES)
    );

    const rootUrl = normalizeUrl(target.toString());
    const rootOrigin = new URL(rootUrl).origin;

    const queue: string[] = [rootUrl];
    const queued = new Set<string>(queue);
    const visited = new Set<string>();
    const pages: PageResult[] = [];
    const issues: AuditIssue[] = [];

    // Sitemap discovery lets the audit find pages that are not exposed
    // as ordinary <a href> links in the initial HTML response.
    try {
      const sitemapUrls = await discoverSitemapUrls(rootUrl, rootOrigin);

      for (const sitemapUrl of sitemapUrls) {
        if (queued.has(sitemapUrl) || visited.has(sitemapUrl)) continue;
        if (queue.length + pages.length >= maxPages) break;
        queued.add(sitemapUrl);
        queue.push(sitemapUrl);
      }
    } catch {
      // Continue with normal internal-link crawling.
    }

    while (queue.length > 0 && pages.length < maxPages) {
      const current = queue.shift();

      if (!current || visited.has(current)) continue;
      visited.add(current);

      try {
        const response = await fetch(current, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          headers: {
            "User-Agent": "ToolNest-Website-Intelligence/1.0",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        const finalUrl = response.url || current;
        const contentType = response.headers.get("content-type") ?? "";

        if (
          !contentType.toLowerCase().includes("text/html") &&
          !contentType.toLowerCase().includes("application/xhtml+xml")
        ) {
          const issue: AuditIssue = {
            severity: "high",
            code: "NOT_HTML",
            title: "Page is not HTML",
            detail: "The discovered URL did not return an HTML document.",
            url: current,
          };

          pages.push({
            url: current,
            finalUrl,
            status: response.status,
            contentType,
            title: "",
            metaDescription: "",
            h1Count: 0,
            canonical: "",
            robots: "",
            wordCount: 0,
            internalLinks: 0,
            externalLinks: 0,
            issues: [issue],
          });

          issues.push(issue);
          continue;
        }

        const html = await response.text();
        const parsed = buildPageResult(
          current,
          response,
          html,
          finalUrl,
          rootOrigin
        );

        pages.push(parsed.page);
        issues.push(...parsed.page.issues);

        for (const link of parsed.links) {
          if (visited.has(link) || queued.has(link)) continue;
          if (queue.length + pages.length >= maxPages) break;

          queued.add(link);
          queue.push(link);
        }
      } catch (error) {
        const issue: AuditIssue = {
          severity: "high",
          code: "PAGE_FETCH_FAILED",
          title: "Page could not be analyzed",
          detail:
            error instanceof Error
              ? error.message
              : "The crawler could not retrieve this page.",
          url: current,
        };

        pages.push({
          url: current,
          finalUrl: current,
          status: 0,
          contentType: "",
          title: "",
          metaDescription: "",
          h1Count: 0,
          canonical: "",
          robots: "",
          wordCount: 0,
          internalLinks: 0,
          externalLinks: 0,
          issues: [issue],
        });

        issues.push(issue);
      }
    }

    const high = issues.filter((issue) => issue.severity === "high").length;
    const medium = issues.filter((issue) => issue.severity === "medium").length;
    const low = issues.filter((issue) => issue.severity === "low").length;
    const missingTitle = issues.filter(
      (issue) => issue.code === "MISSING_TITLE"
    ).length;
    const missingDescription = issues.filter(
      (issue) => issue.code === "MISSING_META_DESCRIPTION"
    ).length;
    const missingH1 = issues.filter(
      (issue) => issue.code === "MISSING_H1"
    ).length;
    const missingCanonical = issues.filter(
      (issue) => issue.code === "MISSING_CANONICAL"
    ).length;

    const score = pages.length
      ? Math.round(
          pages.reduce(
            (sum, page) => sum + scoreIssues(page.issues),
            0
          ) / pages.length
        )
      : 0;

    const data: AuditData = {
      url: rootUrl,
      finalUrl: pages[0]?.finalUrl || rootUrl,
      status: pages[0]?.status ?? 0,
      contentType: pages[0]?.contentType ?? "",
      score,
      pagesScanned: pages.length,
      pages,
      issues,
      summary: {
        high,
        medium,
        low,
        missingTitle,
        missingDescription,
        missingH1,
        missingCanonical,
      },
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Website audit error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze this website.",
      },
      { status: 500 }
    );
  }
}
