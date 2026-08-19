"use client";

import { useEffect, useMemo, useState } from "react";

type PageResult = {
  url: string;
  status: number;
  depth?: number;
  internalLinks: number;
};

type AuditData = { pages: PageResult[] };

export default function CrawlCoveragePage() {
  const [audit, setAudit] = useState<AuditData | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("toolnest-audit-result");
      if (raw) setAudit(JSON.parse(raw) as AuditData);
    } catch {
      setAudit(null);
    }
  }, []);

  const pages = audit?.pages ?? [];
  const stats = useMemo(() => {
    const status2xx = pages.filter((p) => p.status >= 200 && p.status < 300).length;
    const status3xx = pages.filter((p) => p.status >= 300 && p.status < 400).length;
    const status4xx = pages.filter((p) => p.status >= 400 && p.status < 500).length;
    const status5xx = pages.filter((p) => p.status >= 500).length;
    const failed = pages.filter((p) => !p.status).length;
    const maxDepth = pages.length ? Math.max(...pages.map((p) => p.depth ?? 0)) : 0;
    const deepPages = pages.filter((p) => (p.depth ?? 0) > 3);
    const orphanPages = pages.filter((p) => p.internalLinks === 0);
    return { status2xx, status3xx, status4xx, status5xx, failed, maxDepth, deepPages, orphanPages };
  }, [pages]);

  if (!audit) {
    return <main className="shell"><section className="panel"><h1>Crawl Coverage</h1><p>No audit data is available. Run a website audit first.</p><a href="/">Back to Audit Dashboard</a></section></main>;
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · CRAWL COVERAGE</p>
        <h1>Crawl Coverage Details</h1>
        <p className="subtitle">HTTP status distribution, crawl depth and pages with weak internal-link coverage from the latest audit.</p>
      </section>

      <section className="stats-grid">
        <Stat label="2xx Success" value={stats.status2xx} />
        <Stat label="3xx Redirects" value={stats.status3xx} />
        <Stat label="4xx Errors" value={stats.status4xx} />
        <Stat label="5xx Errors" value={stats.status5xx} />
        <Stat label="Failed Fetches" value={stats.failed} />
        <Stat label="Max Crawl Depth" value={stats.maxDepth} />
      </section>

      <section className="panel">
        <h2>Orphan / Weak Internal Linking</h2>
        <p>Pages with zero detected internal links in the crawl result.</p>
        {stats.orphanPages.length === 0 ? <div className="success-box">No zero-internal-link pages detected.</div> : <List pages={stats.orphanPages} />}
      </section>

      <section className="panel">
        <h2>Deep Pages</h2>
        <p>Pages beyond crawl depth 3.</p>
        {stats.deepPages.length === 0 ? <div className="success-box">No pages deeper than level 3 detected.</div> : <List pages={stats.deepPages} />}
      </section>

      <section className="panel">
        <a href="/">← Back to Audit Dashboard</a>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function List({ pages }: { pages: PageResult[] }) {
  return <div className="issues-list">{pages.map((page, index) => <article className="issue" key={`${page.url}-${index}`}><span className={`severity ${page.status >= 400 ? "high" : "medium"}`}>{page.status || "Failed"}</span><div className="issue-content"><strong>{page.url}</strong><p>Depth: {page.depth ?? 0} · Internal links: {page.internalLinks}</p></div></article>)}</div>;
}
