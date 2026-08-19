"use client";

import { useEffect, useState } from "react";

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

function readSeverityFromPath(): string {
  if (typeof window === "undefined") return "";

  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function normalizeSeverity(value: unknown): Severity {
  if (value === "high" || value === "medium") return value;
  return "low";
}

export default function SeverityIssuesPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [rawSeverity, setRawSeverity] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRawSeverity(readSeverityFromPath());

    try {
      const raw = window.sessionStorage.getItem("toolnest-audit-result");

      if (raw) {
        const parsed: unknown = JSON.parse(raw);

        if (parsed && typeof parsed === "object") {
          const source = parsed as {
            finalUrl?: unknown;
            issues?: unknown;
          };

          const issues: AuditIssue[] = Array.isArray(source.issues)
            ? source.issues
                .filter(
                  (issue): issue is Record<string, unknown> =>
                    Boolean(issue) && typeof issue === "object",
                )
                .map(
                  (issue): AuditIssue => ({
                    severity: normalizeSeverity(issue.severity),
                    code:
                      typeof issue.code === "string" ? issue.code : "UNKNOWN",
                    title:
                      typeof issue.title === "string"
                        ? issue.title
                        : "Audit issue",
                    detail:
                      typeof issue.detail === "string"
                        ? issue.detail
                        : "No additional details available.",
                    url: typeof issue.url === "string" ? issue.url : "",
                  }),
                )
            : [];

          setData({
            finalUrl:
              typeof source.finalUrl === "string" ? source.finalUrl : "",
            issues,
          });
        }
      }
    } catch {
      setData(null);
    } finally {
      setReady(true);
    }
  }, []);

  const severity = rawSeverity.toLowerCase();
  const valid =
    severity === "high" || severity === "medium" || severity === "low";
  const typedSeverity: Severity = valid ? (severity as Severity) : "low";
  const issues =
    data?.issues.filter((issue) => issue.severity === typedSeverity) ?? [];

  const title = valid
    ? `${typedSeverity[0].toUpperCase()}${typedSeverity.slice(1)} Issues`
    : "Issues";

  if (!ready) {
    return (
      <main className="shell">
        <section className="status-box">
          <strong>Loading audit results...</strong>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · AUDIT RESULTS</p>
        <h1>{title}</h1>
        <p className="subtitle">
          Page-level findings collected during the latest direct website crawl.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{title}</h2>
            <p>{data?.finalUrl || "No saved audit"}</p>
          </div>
          <span className="verified">{issues.length} findings</span>
        </div>

        {!valid ? (
          <div className="error-box">
            <strong>Invalid issue type</strong>
            <p>Use high, medium or low.</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="success-box">
            No {typedSeverity} issues were detected in this audit.
          </div>
        ) : (
          <div className="issues-list">
            {issues.map((issue, index) => (
              <article
                className="issue"
                key={`${issue.code}-${issue.url}-${index}`}
              >
                <span className={`severity ${issue.severity}`}>
                  {issue.severity}
                </span>
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
        <button type="button" onClick={() => (window.location.href = "/")}>
          ← Back to Audit
        </button>
        <button
          type="button"
          onClick={() => (window.location.href = "/page-details")}
        >
          Page-wise Details →
        </button>
      </div>
    </main>
  );
}
