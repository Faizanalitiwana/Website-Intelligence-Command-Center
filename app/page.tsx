"use client";

import { useState } from "react";

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
  lang: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  structuredData: boolean;
  imageCount: number;
  missingImageAlt: number;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  depth?: number;
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
    missingOpenGraphTitle: number;
    missingOpenGraphDescription: number;
    missingOpenGraphImage: number;
    missingStructuredData: number;
    missingImageAlt: number;
  };
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditData | null>(null);
  const [error, setError] = useState("");

  async function startAudit() {
    const value = url.trim();
    if (!value || loading) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value, maxPages: Number(maxPages) || 100 }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload?.error || "Website audit could not be completed.");
      const auditData = payload.data as AuditData;
      setResult(auditData);
      window.sessionStorage.setItem("toolnest-audit-result", JSON.stringify(auditData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Website audit could not be completed.");
    } finally { setLoading(false); }
  }

  function openResults(path: string) {
    if (!result) return;
    window.sessionStorage.setItem("toolnest-audit-result", JSON.stringify(result));
    window.location.href = path;
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · PRIVATE WEBSITE INTELLIGENCE</p>
        <h1>Website Intelligence Command Center</h1>
        <p className="subtitle">Crawl internal website pages and analyze core technical SEO, social metadata, structured data and accessibility signals in one private server-side audit.</p>
        <div className="audit-box">
          <label htmlFor="website-url">Website URL</label>
          <div className="input-row"><input id="website-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") startAudit(); }} placeholder="https://example.com" autoComplete="url" /><button type="button" onClick={startAudit} disabled={!url.trim() || loading}>{loading ? "Crawling..." : "Run Website Audit"}</button></div>
          <label htmlFor="max-pages">Maximum pages to scan</label>
          <select id="max-pages" value={maxPages} onChange={(e) => setMaxPages(e.target.value)}><option value="25">25 pages</option><option value="50">50 pages</option><option value="100">100 pages</option></select>
          <p className="privacy-note">100% Private / No Upload — pages are fetched server-side for analysis. The crawler uses sitemap discovery when available, then follows same-domain HTML links.</p>
        </div>
      </section>
      {loading && <section className="status-box"><div className="loader" /><div><strong>Crawling website...</strong><p>Discovering pages and checking technical SEO, Open Graph, structured data and image accessibility signals.</p></div></section>}
      {error && <section className="error-box"><strong>Audit failed</strong><p>{error}</p></section>}
      {result && !loading && <>
        <section className="stats-grid"><StatCard label="Health Score" value={`${result.score}/100`} /><StatCard label="Pages Scanned" value={String(result.pagesScanned)} /><StatCard label="High Issues" value={String(result.summary.high)} /><StatCard label="Medium Issues" value={String(result.summary.medium)} /><StatCard label="Low Issues" value={String(result.summary.low)} /><StatCard label="Missing Titles" value={String(result.summary.missingTitle)} /></section>
        <section className="panel"><div className="panel-header"><div><h2>Issue Breakdown</h2><p>Open a dedicated page for each severity level or inspect crawl coverage and every scanned page.</p></div></div><div className="stats-grid"><ResultButton label="High Issues" value={result.summary.high} onClick={() => openResults("/issues/high")} /><ResultButton label="Medium Issues" value={result.summary.medium} onClick={() => openResults("/issues/medium")} /><ResultButton label="Low Issues" value={result.summary.low} onClick={() => openResults("/issues/low")} /><ResultButton label="Page-wise Details" value={result.pages.length} onClick={() => openResults("/page-details")} /><ResultButton label="Duplicate SEO Details" value={result.pages.length} onClick={() => openResults("/duplicate-details")} /><ResultButton label="Crawl Coverage" value={result.pages.length} onClick={() => openResults("/crawl-coverage")} /><ResultButton label="Sitemap & Robots" value={result.pages.length} onClick={() => openResults("/sitemap-intelligence")} /></div></section>
        <section className="panel"><div className="panel-header"><div><h2>Crawl Overview</h2><p>{result.finalUrl}</p></div><span className="verified">Direct Crawl · {result.pagesScanned} pages</span></div><div className="scope-grid"><ScopeItem label="Missing Descriptions" value={String(result.summary.missingDescription)} /><ScopeItem label="Missing H1" value={String(result.summary.missingH1)} /><ScopeItem label="Missing Canonical" value={String(result.summary.missingCanonical)} /><ScopeItem label="Missing OG Title" value={String(result.summary.missingOpenGraphTitle)} /><ScopeItem label="Missing OG Description" value={String(result.summary.missingOpenGraphDescription)} /><ScopeItem label="Missing OG Image" value={String(result.summary.missingOpenGraphImage)} /><ScopeItem label="No Structured Data" value={String(result.summary.missingStructuredData)} /><ScopeItem label="Pages With Image Alt Issues" value={String(result.summary.missingImageAlt)} /><ScopeItem label="HTTP Status" value={String(result.status)} /></div></section>
        <section className="panel"><div className="panel-header"><div><h2>Scanned Pages</h2><p>Every discovered same-domain page included in this crawl.</p></div></div><div className="issues-list">{result.pages.map((page, index) => <article className="issue" key={`${page.url}-${index}`}><span className={`severity ${page.status >= 400 ? "high" : "low"}`}>{page.status >= 400 ? page.status : "OK"}</span><div className="issue-content"><strong>{page.title || "Untitled page"}</strong><p>{page.url}</p><code>{page.status} · depth {page.depth ?? 0} · {page.wordCount} words · {page.internalLinks} internal links · {page.externalLinks} external links · {page.issues.length} issues</code><div className="page-signal-grid"><Signal label="H1" value={String(page.h1Count)} /><Signal label="Canonical" value={page.canonical ? "Yes" : "No"} /><Signal label="OG" value={page.ogTitle && page.ogDescription ? "Ready" : "Partial"} /><Signal label="JSON-LD" value={page.structuredData ? "Yes" : "No"} /><Signal label="Images" value={`${page.imageCount}/${page.missingImageAlt} alt gaps`} /><Signal label="Lang" value={page.lang || "Missing"} /></div></div></article>)}</div></section>
        <section className="panel"><div className="panel-header"><div><h2>Audit Findings</h2><p>Issues detected across the scanned pages.</p></div></div>{result.issues.length === 0 ? <div className="success-box">No technical issues were detected in the current crawl scope.</div> : <div className="issues-list">{result.issues.slice(0, 150).map((issue, index) => <article className="issue" key={`${issue.code}-${issue.url}-${index}`}><span className={`severity ${issue.severity}`}>{issue.severity}</span><div className="issue-content"><strong>{issue.title}</strong><p>{issue.detail}</p><code>{issue.url}</code></div></article>)}</div>}</section>
      </>}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>; }
function ResultButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) { return <button type="button" className="stat-card" onClick={onClick} style={{ textAlign: "left", cursor: "pointer" }}><span>{label}</span><strong>{value}</strong></button>; }
function ScopeItem({ label, value }: { label: string; value: string }) { return <div className="scope-item"><span>{label}</span><strong>{value}</strong></div>; }
function Signal({ label, value }: { label: string; value: string }) { return <span className="signal"><small>{label}</small><strong>{value}</strong></span>; }
