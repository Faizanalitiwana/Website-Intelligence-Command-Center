export type SitemapIntelligence = {
  robotsUrl: string;
  robotsStatus: number | null;
  robotsFound: boolean;
  sitemapUrls: string[];
  sitemapStatus: number | null;
  sitemapFound: boolean;
  sitemapUrlCount: number;
  indexedBySitemap: string[];
  missingFromSitemap: string[];
  sitemapOnlyUrls: string[];
  errors: string[];
};

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function isHttp(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchText(url: string, accept: string): Promise<{ status: number | null; text: string }> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "ToolNest-Website-Intelligence/1.0", Accept: accept },
      signal: AbortSignal.timeout(12000),
    });
    return { status: response.status, text: await response.text() };
  } catch {
    return { status: null, text: "" };
  }
}

function locs(xml: string, base: URL): string[] {
  const result = new Set<string>();
  const re = /<loc\\b[^>]*>([\\s\\S]*?)<\\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = (m[1] ?? "").replace(/<[^>]+>/g, "").trim();
    if (!raw) continue;
    try {
      const u = new URL(raw, base);
      if (isHttp(u.toString())) result.add(normalizeUrl(u.toString()));
    } catch {}
  }
  return [...result];
}

export async function analyzeSitemap(rootUrl: string, crawledUrls: string[]): Promise<SitemapIntelligence> {
  const root = new URL(rootUrl);
  const robotsUrl = new URL("/robots.txt", root).toString();
  const candidates = new Set<string>([
    new URL("/sitemap.xml", root).toString(),
    new URL("/sitemap_index.xml", root).toString(),
  ]);
  const errors: string[] = [];
  const robots = await fetchText(robotsUrl, "text/plain,*/*;q=0.1");
  if (robots.status !== 200) errors.push("robots.txt could not be fetched successfully.");
  for (const line of robots.text.split(/\\r?\\n/)) {
    const m = line.match(/^\\s*sitemap\\s*:\\s*(\\S+)\\s*$/i);
    if (!m?.[1]) continue;
    try {
      const u = new URL(m[1], root);
      if (u.origin === root.origin) candidates.add(normalizeUrl(u.toString()));
    } catch {}
  }

  const queue = [...candidates];
  const visited = new Set<string>();
  const sitemapUrls = new Set<string>();
  let sitemapStatus: number | null = null;
  while (queue.length && visited.size < 10) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const result = await fetchText(url, "application/xml,text/xml,text/plain,*/*;q=0.1");
    sitemapStatus = result.status;
    if (result.status !== 200 || !result.text) continue;
    const locations = locs(result.text, new URL(url));
    if (/<sitemapindex\\b/i.test(result.text)) {
      for (const child of locations) {
        if (new URL(child).origin === root.origin && !visited.has(child)) queue.push(child);
      }
    } else {
      for (const page of locations) {
        if (new URL(page).origin === root.origin) sitemapUrls.add(page);
      }
    }
  }

  const crawled = new Set(crawledUrls.map((u) => normalizeUrl(u)));
  const indexed = [...sitemapUrls].filter((u) => crawled.has(u));
  const missingFromSitemap = [...crawled].filter((u) => !sitemapUrls.has(u));
  const sitemapOnlyUrls = [...sitemapUrls].filter((u) => !crawled.has(u));

  return {
    robotsUrl,
    robotsStatus: robots.status,
    robotsFound: robots.status === 200,
    sitemapUrls: [...candidates],
    sitemapStatus,
    sitemapFound: sitemapUrls.size > 0,
    sitemapUrlCount: sitemapUrls.size,
    indexedBySitemap: indexed,
    missingFromSitemap,
    sitemapOnlyUrls,
    errors,
  };
}
