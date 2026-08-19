"use client";

import { useEffect, useMemo, useState } from "react";

type PageResult = {
  url: string;
  title: string;
  metaDescription: string;
  issues: Array<{ severity: string; code: string; title: string; detail: string; url: string }>;
};

type AuditData = { pages: PageResult[] };

type DuplicateGroup = { value: string; pages: PageResult[] };

export default function DuplicateDetailsPage() {
  const [audit, setAudit] = useState<AuditData | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("toolnest-audit-result");
      if (raw) setAudit(JSON.parse(raw) as AuditData);
    } catch {
      setAudit(null);
    }
  }, []);

  const duplicateTitles = useMemo(() => {
    return buildGroups(audit?.pages ?? [], (page) => page.title);
  }, [audit]);

  const duplicateDescriptions = useMemo(() => {
    return buildGroups(audit?.pages ?? [], (page) => page.metaDescription);
  }, [audit]);

  if (!audit) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Duplicate SEO Details</h1>
          <p>No audit data is available. Run a website audit first.</p>
          <a href="/">Back to Audit</a>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · SEO QUALITY CONTROL</p>
        <h1>Duplicate SEO Details</h1>
        <p className="subtitle">
          Page-wise duplicate title and meta-description groups detected in the latest crawl.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Duplicate Titles</h2>
            <p>{duplicateTitles.length} duplicate groups</p>
          </div>
        </div>
        <DuplicateGroups groups={duplicateTitles} empty="No duplicate page titles detected." />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Duplicate Meta Descriptions</h2>
            <p>{duplicateDescriptions.length} duplicate groups</p>
          </div>
        </div>
        <DuplicateGroups groups={duplicateDescriptions} empty="No duplicate meta descriptions detected." />
      </section>

      <section className="panel">
        <a href="/">← Back to Audit Dashboard</a>
      </section>
    </main>
  );
}

function buildGroups(
  pages: PageResult[],
  getValue: (page: PageResult) => string
): DuplicateGroup[] {
  const map = new Map<string, PageResult[]>();

  for (const page of pages) {
    const value = getValue(page).trim();
    if (!value) continue;
    const existing = map.get(value) ?? [];
    existing.push(page);
    map.set(value, existing);
  }

  return [...map.entries()]
    .filter(([, groupedPages]) => groupedPages.length > 1)
    .map(([value, groupedPages]) => ({ value, pages: groupedPages }));
}

function DuplicateGroups({ groups, empty }: { groups: DuplicateGroup[]; empty: string }) {
  if (groups.length === 0) return <div className="success-box">{empty}</div>;

  return (
    <div className="issues-list">
      {groups.map((group) => (
        <article className="issue" key={group.value}>
          <span className="severity medium">{group.pages.length} pages</span>
          <div className="issue-content">
            <strong>{group.value}</strong>
            <p>These pages share the same SEO value and should be reviewed for uniqueness.</p>
            {group.pages.map((page) => (
              <code key={page.url} style={{ display: "block", marginTop: 6 }}>
                {page.url}
              </code>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
