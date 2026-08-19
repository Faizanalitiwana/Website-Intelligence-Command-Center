"use client";
import { useEffect, useState } from "react";

type Data = {
  robotsUrl: string; robotsStatus: number | null; robotsFound: boolean;
  sitemapUrls: string[]; sitemapStatus: number | null; sitemapFound: boolean;
  sitemapUrlCount: number; indexedBySitemap: string[];
  missingFromSitemap: string[]; sitemapOnlyUrls: string[]; errors: string[];
};

export default function SitemapIntelligencePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("toolnest-audit-result");
    if (!raw) { setError("No audit result found. Run a website audit first."); setLoading(false); return; }
    try {
      const audit = JSON.parse(raw) as { url?: string; pages?: Array<{ url?: string }> };
      fetch("/api/sitemap-intelligence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: audit.url, crawledUrls: (audit.pages ?? []).map((p) => p.url).filter(Boolean) })
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload?.error || "Sitemap analysis failed.");
        setData(payload.data as Data);
      }).catch((err) => setError(err instanceof Error ? err.message : "Sitemap analysis failed."))
        .finally(() => setLoading(false));
    } catch { setError("Saved audit data is invalid. Run the audit again."); setLoading(false); }
  }, []);

  return <main className="shell"><section className="hero"><p className="eyebrow">TOOLNEST · SITEMAP INTELLIGENCE</p><h1>Sitemap & Robots Intelligence</h1><p className="subtitle">Compare discovered crawl URLs with sitemap coverage and verify robots.txt sitemap declarations.</p></section>
    {loading && <section className="status-box"><div className="loader" /><div><strong>Analyzing sitemap...</strong><p>Checking robots.txt, sitemap.xml and sitemap indexes.</p></div></section>}
    {error && <section className="error-box"><strong>Analysis failed</strong><p>{error}</p></section>}
    {data && !loading && <><section className="stats-grid"><Card label="Sitemap URLs" value={data.sitemapUrlCount} /><Card label="Crawled In Sitemap" value={data.indexedBySitemap.length} /><Card label="Missing From Sitemap" value={data.missingFromSitemap.length} /><Card label="Sitemap Only" value={data.sitemapOnlyUrls.length} /><Card label="Robots.txt" value={data.robotsFound ? "Found" : "Missing"} /><Card label="Sitemap" value={data.sitemapFound ? "Found" : "Missing"} /></section>
      <section className="panel"><h2>Coverage Status</h2><div className="scope-grid"><Item label="robots.txt status" value={String(data.robotsStatus ?? "Failed")} /><Item label="Sitemap status" value={String(data.sitemapStatus ?? "Failed")} /><Item label="Robots URL" value={data.robotsUrl} /></div></section>
      <List title="Pages Missing From Sitemap" items={data.missingFromSitemap} empty="All crawled pages are represented in the sitemap." />
      <List title="Sitemap URLs Not Crawled" items={data.sitemapOnlyUrls} empty="No sitemap-only URLs were found." />
    </>}
  </main>;
}
function Card({ label, value }: { label: string; value: number | string }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>; }
function Item({ label, value }: { label: string; value: string }) { return <div className="scope-item"><span>{label}</span><strong>{value}</strong></div>; }
function List({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <section className="panel"><h2>{title}</h2>{items.length === 0 ? <div className="success-box">{empty}</div> : <div className="issues-list">{items.slice(0, 200).map((item, i) => <article className="issue" key={`${item}-${i}`}><div className="issue-content"><code>{item}</code></div></article>)}</div>}</section>; }
