function normalize(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch { return value.trim(); }
}

function isHttp(value: string): boolean {
  try { const u = new URL(value); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
}

async function fetchText(url: string): Promise<{ status: number | null; text: string }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ToolNest-Website-Intelligence/1.0", Accept: "text/plain,text/xml,application/xml" },
      cache: "no-store",
    });
    return { status: response.status, text: await response.text() };
  } catch { return { status: null, text: "" }; }
}

function locs(xml: string, base: URL): string[] {
  const result = new Set<string>();
  const re = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = (m[1] ?? "").replace(/<[^>]+>/g, "").trim();
    if (!raw) continue;
    try { const u = new URL(raw, base); if (isHttp(u.toString())) result.add(normalize(u.toString())); }
    catch { /* ignore malformed URL */ }
  }
  return [...result];
}

export type SitemapIntelligence = {
  robotsStatus: number | null;
  robotsFound: boolean;
  robotsSitemaps: string[];
  sitemapStatus: number | null;
  sitemapFound: boolean;
  sitemapUrls: string[];
  sitemapIndexes: string[];
  sitemapMissingFromCrawl: string[];
  crawledMissingFromSitemap: string[];
};

export async function analyzeSitemap(startUrl: string, crawledUrls: string[] = []): Promise<SitemapIntelligence> {
  const root = new URL(startUrl);
  const origin = `${root.protocol}//${root.host}`;
  const robots = await fetchText(`${origin}/robots.txt`);
  const robotsSitemaps = robots.text.split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap\s*:\s*(\S+)/i)?.[1] ?? "")
    .filter(isHttp).map(normalize);

  const sitemapUrls = new Set<string>();
  const sitemapIndexes = new Set<string>();
  let sitemapStatus: number | null = null;
  let sitemapFound = false;
  const candidates = [...new Set([...robotsSitemaps, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`])];

  for (const sitemapUrl of candidates) {
    const response = await fetchText(sitemapUrl);
    if (response.status === null) continue;
    if (sitemapStatus === null || response.status < sitemapStatus) sitemapStatus = response.status;
    if (response.status < 200 || response.status >= 400 || !response.text) continue;
    sitemapFound = true;
    const urls = locs(response.text, new URL(sitemapUrl));
    if (response.text.toLowerCase().includes("<sitemapindex")) urls.forEach((u) => sitemapIndexes.add(u));
    else urls.forEach((u) => sitemapUrls.add(u));
  }

  for (const child of sitemapIndexes) {
    const response = await fetchText(child);
    if (response.status === null || response.status < 200 || response.status >= 400) continue;
    locs(response.text, new URL(child)).forEach((u) => sitemapUrls.add(u));
  }

  const sitemapSet = new Set([...sitemapUrls].map(normalize));
  const crawlSet = new Set(crawledUrls.filter(isHttp).map(normalize));

  return {
    robotsStatus: robots.status,
    robotsFound: robots.status !== null && robots.status >= 200 && robots.status < 400,
    robotsSitemaps: [...new Set(robotsSitemaps)],
    sitemapStatus,
    sitemapFound,
    sitemapUrls: [...sitemapSet],
    sitemapIndexes: [...sitemapIndexes],
    sitemapMissingFromCrawl: [...sitemapSet].filter((u) => !crawlSet.has(u)),
    crawledMissingFromSitemap: [...crawlSet].filter((u) => !sitemapSet.has(u)),
  };
}

export const analyzeSitemapIntelligence = analyzeSitemap;
