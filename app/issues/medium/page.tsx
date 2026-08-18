"use client";

import { useEffect, useState } from "react";

type AuditIssue = { severity: "high" | "medium" | "low"; code: string; title: string; detail: string; url: string };
type AuditData = { finalUrl: string; issues: AuditIssue[] };

export default function MediumIssuesPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("toolnest-audit-result");
      if (raw) setData(JSON.parse(raw) as AuditData);
    } catch { setData(null); }
    finally { setReady(true); }
  }, []);

  const issues = data?.issues.filter((issue) => issue.severity === "medium") ?? [];

  if (!ready) return <main className="shell"><section className="status-box"><strong>Loading audit results...</strong></section></main>;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · AUDIT RESULTS</p>
        <h1>Medium Issues</h1>
        <p className="subtitle">Medium-severity findings from the latest direct website crawl.</p>
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2>Medium Issues</h2><p>{data?.finalUrl ?? "No saved audit"}</p></div><span className="verified">{issues.length} findings</span></div>
        {!data ? <div className="error-box"><strong>No audit result available</strong><p>Run a website audit from the home page first.</p></div> : issues.length === 0 ? <div className="success-box">No medium issues were detected in this audit.</div> : (
          <div className="issues-list">{issues.map((issue, index) => <article className="issue" key={`${issue.code}-${issue.url}-${index}`}><span className="severity medium">medium</span><div className="issue-content"><strong>{issue.title}</strong><p>{issue.detail}</p><code>{issue.url}</code></div></article>)}</div>
        )}
      </section>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => (window.location.href = "/")}>← Back to Audit</button>
        <button type="button" onClick={() => (window.location.href = "/issues/high")}>High Issues</button>
        <button type="button" onClick={() => (window.location.href = "/issues/low")}>Low Issues</button>
        <button type="button" onClick={() => (window.location.href = "/page-details")}>Page-wise Details →</button>
      </div>
    </main>
  );
}
