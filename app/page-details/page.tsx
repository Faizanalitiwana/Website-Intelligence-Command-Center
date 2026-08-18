"use client";

import { useEffect, useState } from "react";

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
  issues: AuditIssue[];
};

type AuditData = {
  finalUrl: string;
  pages: PageResult[];
};

export default function PageDetails() {
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

  if (!ready) {
    return <main className="shell"><section className="status-box"><strong>Loading page details...</strong></section></main>;
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · PAGE-WISE AUDIT</p>
        <h1>Page-wise Details</h1>
        <p className="subtitle">
          Detailed technical signals and findings for every page included in the latest crawl.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Scanned Pages</h2>
            <p>{data?.finalUrl ?? "No saved audit"}</p>
          </div>
          <span className="verified">{data?.pages.length ?? 0} pages</span>
        </div>

        {!data || data.pages.length === 0 ? (
          <div className="error-box">
            <strong>No audit result available</strong>
            <p>Run a website audit from the home page first.</p>
          </div>
        ) : (
          <div className="issues-list">
            {data.pages.map((page, index) => (
              <article className="issue" key={`${page.url}-${index}`}>
                <span className={`severity ${page.status >= 400 ? "high" : "low"}`}>
                  {page.status >= 400 ? page.status : "OK"}
                </span>

                <div className="issue-content">
                  <strong>{page.title || "Untitled page"}</strong>
                  <p>{page.url}</p>

                  <div className="page-signal-grid">
                    <Signal label="HTTP" value={String(page.status)} />
                    <Signal label="H1" value={String(page.h1Count)} />
                    <Signal label="Title" value={page.title ? "Yes" : "Missing"} />
                    <Signal label="Description" value={page.metaDescription ? "Yes" : "Missing"} />
                    <Signal label="Canonical" value={page.canonical ? "Yes" : "Missing"} />
                    <Signal label="Robots" value={page.robots || "None"} />
                    <Signal label="OG Title" value={page.ogTitle ? "Yes" : "Missing"} />
                    <Signal label="OG Image" value={page.ogImage ? "Yes" : "Missing"} />
                    <Signal label="JSON-LD" value={page.structuredData ? "Yes" : "No"} />
                    <Signal label="Images" value={String(page.imageCount)} />
                    <Signal label="Alt gaps" value={String(page.missingImageAlt)} />
                    <Signal label="Words" value={String(page.wordCount)} />
                    <Signal label="Internal" value={String(page.internalLinks)} />
                    <Signal label="External" value={String(page.externalLinks)} />
                    <Signal label="Lang" value={page.lang || "Missing"} />
                    <Signal label="Issues" value={String(page.issues.length)} />
                  </div>

                  {page.issues.length > 0 && (
                    <div className="issues-list" style={{ marginTop: 16 }}>
                      {page.issues.map((issue, issueIndex) => (
                        <div className="issue" key={`${issue.code}-${issueIndex}`}>
                          <span className={`severity ${issue.severity}`}>{issue.severity}</span>
                          <div className="issue-content">
                            <strong>{issue.title}</strong>
                            <p>{issue.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={() => (window.location.href = "/")}>← Back to Audit</button>
        <button type="button" onClick={() => (window.location.href = "/issues/high")}>High Issues</button>
        <button type="button" onClick={() => (window.location.href = "/issues/medium")}>Medium Issues</button>
        <button type="button" onClick={() => (window.location.href = "/issues/low")}>Low Issues</button>
      </div>
    </main>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <span className="signal">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}
