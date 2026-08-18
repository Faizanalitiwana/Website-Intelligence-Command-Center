"use client";

import { use, useEffect, useState } from "react";

type Severity = "high" | "medium" | "low";

type AuditIssue = {
  severity: Severity;
  code: string;
  title: string;
  detail: string;
  url: string;
};

type AuditData = {
  finalUrl: string;
  issues: AuditIssue[];
};

export default function SeverityIssuesPage({
  params,
}: {
  params: Promise<{ severity: string }>;
}) {
  const { severity: rawSeverity } = use(params);
  const [data, setData] = useState<AuditData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("toolnest-audit-result");
      if (raw) setData(JSON.parse(raw) as AuditData);
    } catch {
      setData(null);
    } finally {
      setReady(true);
    }
  }, []);

  const severity = rawSeverity.toLowerCase() as Severity;
  const valid = severity === "high" || severity === "medium" || severity === "low";
  const issues = data?.issues.filter((issue) => issue.severity === severity) ?? [];
  const title = valid ? `${severity[0].toUpperCase()}${severity.slice(1)} Issues` : "Issues";

  if (!ready) {
    return <main className="shell"><section className="status-box"><strong>Loading audit results...</strong></section></main>;
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · AUDIT RESULTS</p>
        <h1>{title}</h1>
        <p className="subtitle">Page-level findings collected during the latest direct website crawl.</p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{title}</h2>
            <p>{data?.finalUrl ?? "No saved audit"}</p>
          </div>
          <span className="verified">{issues.length} findings</span>
        </div>

        {!valid ? (
          <div className="error-box"><strong>Invalid issue type</strong><p>Use high, medium or low.</p></div>
        ) : issues.length === 0 ? (
          <div className="success-box">No {severity} issues were detected in this audit.</div>
        ) : (
          <div className="issues-list">
            {issues.map((issue, index) => (
              <article className="issue" key={`${issue.code}-${issue.url}-${index}`}>
                <span className={`severity ${issue.severity}`}>{issue.severity}</span>
                <div className="issue-content">
                  <strong>{issue.title}</strong>
                  <p>{issue.detail}</p>
                  <code>{issue.url}</code>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => (window.location.href = "/")}>← Back to Audit</button>
        <button type="button" onClick={() => (window.location.href = "/page-details")}>Page-wise Details →</button>
      </div>
    </main>
  );
}
