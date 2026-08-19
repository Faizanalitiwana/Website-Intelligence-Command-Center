import type { PageAudit } from "@/types/audit";

export type CrawlCoverage = {
  totalCrawled: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  failed: number;
  maxDepth: number;
  deepPages: PageAudit[];
  orphanPages: PageAudit[];
};

export function calculateCrawlCoverage(
  pages: PageAudit[],
  deepPageDepth = 3
): CrawlCoverage {
  const status2xx = pages.filter((page) => page.status !== null && page.status >= 200 && page.status < 300).length;
  const status3xx = pages.filter((page) => page.status !== null && page.status >= 300 && page.status < 400).length;
  const status4xx = pages.filter((page) => page.status !== null && page.status >= 400 && page.status < 500).length;
  const status5xx = pages.filter((page) => page.status !== null && page.status >= 500).length;
  const failed = pages.filter((page) => page.status === null).length;
  const depths = pages.map((page) => page.depth ?? 0);

  return {
    totalCrawled: pages.length,
    status2xx,
    status3xx,
    status4xx,
    status5xx,
    failed,
    maxDepth: depths.length ? Math.max(...depths) : 0,
    deepPages: pages.filter((page) => (page.depth ?? 0) > deepPageDepth),
    orphanPages: pages.filter((page) => page.internalLinks === 0),
  };
}
