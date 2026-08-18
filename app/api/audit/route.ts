import { NextRequest, NextResponse } from "next/server";

type AuditIssue = {
  severity: "high" | "medium" | "low";
  code: string;
  title: string;
  detail: string;
};

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
  const first = firstMatch(
    html,
    new RegExp(`<meta\\b[^>]*\\bname=["']${escaped}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>`, "i")
  );
  if (first) return first;
  return firstMatch(
    html,
    new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bname=["']${escaped}["'][^>]*>`, "i")
  );
}

function getCanonical(html: string): string {
  const first = firstMatch(
    html,
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i
  );
  if (first) return first;
  return firstMatch(
    html,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i
  );
}

function countTags(html: string, tag: string): number {
  return html.match(new RegExp(`<${tag}\\b`, "gi"))?.length ?? 0;
}

function extractLinks(html: string, baseUrl: URL) {
  const links = new Set<string>();
  const regex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    try {
      const url = new URL(href, baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      url.hash = "";
      url.search = "";
      links.add(url.toString());
    } catch {
      // Ignore malformed URLs.
    }
  }

  return [...links];
}

function calculateScore(issues: AuditIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === "high") return total + 20;
    if (issue.severity === "medium") return total + 12;
    return total + 6;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: unknown };
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json({ success: false, error: "Website URL is required." }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return NextResponse.json({ success: false, error: "Please enter a valid website URL." }, { status: 400 });
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.json({ success: false, error: "Only HTTP and HTTPS URLs are supported." }, { status: 400 });
    }

    const response = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "ToolNest-Website-Intelligence/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    const finalUrl = response.url || target.toString();
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("text/html") && !contentType.toLowerCase().includes("application/xhtml+xml")) {
      return NextResponse.json({
        success: true,
        data: {
          url: target.toString(),
          finalUrl,
          status: response.status,
          contentType,
          score: 0,
          pagesScanned: 1,
          title: "",
          metaDescription: "",
          h1Count: 0,
          canonical: "",
          robots: "",
          wordCount: 0,
          internalLinks: 0,
          externalLinks: 0,
          issues: [{ severity: "high", code: "NOT_HTML", title: "Page is not HTML", detail: "The target URL did not return an HTML document." }],
        },
      });
    }

    const html = await response.text();
    const final = new URL(finalUrl);
    const title = stripHtml(getTitle(html));
    const metaDescription = getMeta(html, "description");
    const canonical = getCanonical(html);
    const robots = getMeta(html, "robots");
    const h1Count = countTags(html, "h1");
    const text = stripHtml(html);
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const links = extractLinks(html, final);
    const internalLinks = links.filter((link) => {
      try {
        return new URL(link).origin === final.origin;
      } catch {
        return false;
      }
    }).length;
    const externalLinks = links.length - internalLinks;

    const issues: AuditIssue[] = [];

    if (response.status >= 400) {
      issues.push({ severity: "high", code: "HTTP_ERROR", title: "HTTP error detected", detail: `The page returned HTTP status ${response.status}.` });
    }
    if (!title) {
      issues.push({ severity: "high", code: "MISSING_TITLE", title: "Missing page title", detail: "This page does not contain an HTML title." });
    } else if (title.length < 30) {
      issues.push({ severity: "low", code: "SHORT_TITLE", title: "Short page title", detail: "The page title is shorter than the recommended range." });
    } else if (title.length > 60) {
      issues.push({ severity: "low", code: "LONG_TITLE", title: "Long page title", detail: "The page title is longer than the commonly recommended range." });
    }
    if (!metaDescription) {
      issues.push({ severity: "medium", code: "MISSING_META_DESCRIPTION", title: "Missing meta description", detail: "This page does not contain a meta description." });
    }
    if (h1Count === 0) {
      issues.push({ severity: "medium", code: "MISSING_H1", title: "Missing H1 heading", detail: "This page does not contain an H1 heading." });
    } else if (h1Count > 1) {
      issues.push({ severity: "low", code: "MULTIPLE_H1", title: "Multiple H1 headings", detail: `The page contains ${h1Count} H1 headings.` });
    }
    if (!canonical) {
      issues.push({ severity: "low", code: "MISSING_CANONICAL", title: "Missing canonical URL", detail: "This page does not declare a canonical URL." });
    }
    if (robots.toLowerCase().includes("noindex")) {
      issues.push({ severity: "high", code: "NOINDEX_DETECTED", title: "Noindex detected", detail: "The robots meta tag contains noindex." });
    }
    if (wordCount < 300) {
      issues.push({ severity: "low", code: "LOW_WORD_COUNT", title: "Low visible word count", detail: `The page contains approximately ${wordCount} visible words.` });
    }

    const critical = issues.filter((issue) => issue.severity === "high").length;
    const medium = issues.filter((issue) => issue.severity === "medium").length;
    const low = issues.filter((issue) => issue.severity === "low").length;

    return NextResponse.json({
      success: true,
      data: {
        url: target.toString(),
        finalUrl,
        status: response.status,
        contentType,
        score: calculateScore(issues),
        pagesScanned: 1,
        title,
        metaDescription,
        h1Count,
        canonical,
        robots,
        wordCount,
        internalLinks,
        externalLinks,
        issues,
        summary: {
          critical,
          high: critical,
          medium,
          low,
          missingTitle: issues.some((issue) => issue.code === "MISSING_TITLE") ? 1 : 0,
          missingDescription: issues.some((issue) => issue.code === "MISSING_META_DESCRIPTION") ? 1 : 0,
          missingH1: issues.some((issue) => issue.code === "MISSING_H1") ? 1 : 0,
          missingCanonical: issues.some((issue) => issue.code === "MISSING_CANONICAL") ? 1 : 0,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze this website.";
    console.error("Website audit error:", error);
    return NextResponse.json({ success: false, error: message || "Unable to analyze this website." }, { status: 500 });
  }
}
