"use client";

import { useEffect, useMemo, useState } from "react";

type AuditIssue = {
  severity: "high" | "medium" | "low" | string;
  code: string;
  title: string;
  detail: string;
  url: string;
};

type AuditData = {
  issues: AuditIssue[];
};

const recommendations: Record<string, string> = {
  HTTP_ERROR: "Fix the server response first. Check routing, hosting, redirects, authentication and server configuration so the URL returns a successful HTML response.",
  PAGE_FETCH_FAILED: "Verify that the page is reachable without blocking the crawler. Check DNS, TLS, firewall rules, timeouts and server availability.",
  NOT_HTML: "Review whether this URL belongs in the crawl. If it should be an indexable page, make sure it returns an HTML document instead of a file or other content type.",
  MISSING_TITLE: "Add a unique, descriptive HTML title that clearly communicates the page topic and search intent.",
  SHORT_TITLE: "Expand the title with useful topical context while keeping it concise and focused on the primary intent.",
  LONG_TITLE: "Shorten the title and move the most important topic and brand information toward the beginning.",
  MISSING_META_DESCRIPTION: "Add a unique, useful meta description that summarizes the page and encourages a relevant searcher to visit.",
  SHORT_META_DESCRIPTION: "Add meaningful context and a concise call to action so the description better represents the page.",
  LONG_META_DESCRIPTION: "Trim the description to the most useful search-result messaging and remove unnecessary repetition.",
  MISSING_H1: "Add one clear primary H1 that describes the main topic of the page.",
  MULTIPLE_H1: "Review the headings and keep one primary H1. Convert secondary section headings to H2 or lower where appropriate.",
  MISSING_CANONICAL: "Add a self-referencing canonical URL unless the page intentionally canonicalizes to another URL.",
  NOINDEX_DETECTED: "Confirm the noindex directive is intentional. Remove noindex if this page should be eligible for search indexing.",
  MISSING_OG_TITLE: "Add an og:title value so shared links have a clear social title.",
  MISSING_OG_DESCRIPTION: "Add an og:description value that summarizes the page for social sharing.",
  MISSING_OG_IMAGE: "Add an og:image URL using a stable, crawlable social preview image.",
  MISSING_STRUCTURED_DATA: "Add appropriate JSON-LD structured data where the page qualifies, using the schema type that matches its actual content.",
  MISSING_IMAGE_ALT: "Add accurate alt attributes to meaningful images. Use empty alt text for purely decorative images.",
  LOW_WORD_COUNT: "Review whether the page provides enough useful visible content for its purpose. Avoid adding filler text solely to increase word count.",
  MISSING_HTML_LANG: "Add the correct lang attribute to the root HTML element to improve accessibility and language interpretation.",
};

export default function RecommendationsPage() {
  const [audit, setAudit] = useState<AuditData | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("toolnest-audit-result");
      if (raw) setAudit(JSON.parse(raw) as AuditData);
    } catch {
      setAudit(null);
    }
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditIssue[]>();
    for (const issue of audit?.issues ?? []) {
      const existing = map.get(issue.code) ?? [];
      existing.push(issue);
      map.set(issue.code, existing);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [audit]);

  if (!audit) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Technical SEO Recommendations</h1>
          <p>No audit data is available. Run a website audit first.</p>
          <a href="/">Back to Audit</a>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · ACTION CENTER</p>
        <h1>Technical SEO Recommendations</h1>
        <p className="subtitle">Actionable guidance grouped by issue type from the latest website crawl.</p>
      </section>

      {grouped.length === 0 ? (
        <section className="panel">
          <div className="success-box">No audit issues require recommendations in the current crawl.</div>
        </section>
      ) : (
        grouped.map(([code, issues]) => (
          <section className="panel" key={code}>
            <div className="panel-header">
              <div>
                <h2>{issues[0]?.title ?? code}</h2>
                <p>{issues.length} affected page{issues.length === 1 ? "" : "s"}</p>
              </div>
              <span className={`severity ${issues[0]?.severity ?? "low"}`}>{issues[0]?.severity ?? "low"}</span>
            </div>

            <div className="success-box" style={{ textAlign: "left" }}>
              <strong>Recommended action</strong>
              <p>{recommendations[code] ?? "Review this issue manually and apply the fix that best matches the page's actual content and intent."}</p>
            </div>

            <div className="issues-list">
              {issues.slice(0, 100).map((issue, index) => (
                <article className="issue" key={`${issue.url}-${index}`}>
                  <div className="issue-content">
                    <strong>{issue.url}</strong>
                    <p>{issue.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      <section className="panel">
        <a href="/">← Back to Audit Dashboard</a>
      </section>
    </main>
  );
}
