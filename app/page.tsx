"use client";

import { useState } from "react";

type AuditIssue = {
  severity: "high" | "medium" | "low";
  code: string;
  title: string;
  detail: string;
};

type AuditData = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  score: number;
  pagesScanned: number;
  title: string;
  metaDescription: string;
  h1Count: number;
  canonical: string;
  robots: string;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  issues: AuditIssue[];
  summary: {
    high: number;
    medium: number;
    low: number;
    missingTitle: number;
    missingDescription: number;
    missingH1: number;
    missingCanonical: number;
  };
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditData | null>(null);
  const [error, setError] = useState("");

  async function startAudit() {
    const value = url.trim();
    if (!value || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || "Website audit could not be completed.");
      }

      setResult(payload.data as AuditData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Website audit could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · PRIVATE WEBSITE INTELLIGENCE</p>
        <h1>Website Intelligence Command Center</h1>
        <p className="subtitle">
          Analyze a website for core technical SEO signals, page quality, and actionable issues from a private server-side crawl.
        </p>

        <div className="audit-box">
          <label htmlFor="website-url">Website URL</label>
          <div className="input-row">
            <input
              id="website-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") startAudit();
              }}
              placeholder="https://example.com"
              autoComplete="url"
            />
            <button type="button" onClick={startAudit} disabled={!url.trim() || loading}>
              {loading ? "Analyzing..." : "Run Website Audit"}
            </button>
          </div>
          <p className="privacy-note">
            100% Private / No Upload — website content is fetched for analysis and is not presented as uploaded files or external analytics data.
          </p>
        </div>
      </section>

      {loading && (
        <section className="status-box">
          <div className="loader" />
          <div>
            <strong>Analyzing website...</strong>
            <p>Fetching the page and checking core technical SEO signals.</p>
          </div>
        </section>
      )}

      {error && (
        <section className="error-box">
          <strong>Audit failed</strong>
          <p>{error}</p>
        </section>
      )}

      {result && !loading && (
        <>
          <section className="stats-grid">
            <StatCard label="Health Score" value={`${result.score}/100`} />
            <StatCard label="Pages Scanned" value={String(result.pagesScanned)} />
            <StatCard label="HTTP Status" value={String(result.status)} />
            <StatCard label="High Issues" value={String(result.summary.high)} />
            <StatCard label="Medium Issues" value={String(result.summary.medium)} />
            <StatCard label="Low Issues" value={String(result.summary.low)} />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Audit Overview</h2>
                <p>{result.finalUrl}</p>
              </div>
              <span className="verified">Direct Crawl</span>
            </div>

            <div className="scope-grid">
              <ScopeItem label="Title" value={result.title ? "Present" : "Missing"} />
              <ScopeItem label="Meta Description" value={result.metaDescription ? "Present" : "Missing"} />
              <ScopeItem label="H1 Count" value={String(result.h1Count)} />
              <ScopeItem label="Canonical" value={result.canonical ? "Present" : "Missing"} />
              <ScopeItem label="Words" value={String(result.wordCount)} />
              <ScopeItem label="Internal Links" value={String(result.internalLinks)} />
              <ScopeItem label="External Links" value={String(result.externalLinks)} />
              <ScopeItem label="Robots" value={result.robots || "Not set"} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Audit Findings</h2>
                <p>Issues detected on the analyzed page.</p>
              </div>
            </div>

            {result.issues.length === 0 ? (
              <div className="success-box">No technical issues were detected in the current audit scope.</div>
            ) : (
              <div className="issues-list">
                {result.issues.map((issue, index) => (
                  <article className="issue" key={`${issue.code}-${index}`}>
                    <span className={`severity ${issue.severity}`}>{issue.severity}</span>
                    <div className="issue-content">
                      <strong>{issue.title}</strong>
                      <p>{issue.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScopeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="scope-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
