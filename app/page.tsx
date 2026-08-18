"use client";

import { useState } from "react";

export default function HomePage() {
  const [url, setUrl] = useState("");

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TOOLNEST · PRIVATE WEBSITE INTELLIGENCE</p>
        <h1>Website Intelligence Command Center</h1>
        <p className="subtitle">
          A clean foundation for private website crawling, technical SEO
          analysis, and actionable website intelligence.
        </p>

        <div className="audit-box">
          <label htmlFor="website-url">Website URL</label>
          <div className="input-row">
            <input
              id="website-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              autoComplete="url"
            />
            <button type="button" disabled={!url.trim()}>
              Start Audit
            </button>
          </div>
          <p className="privacy-note">
            100% Private / No Upload — this clean foundation does not send
            website data anywhere yet.
          </p>
        </div>
      </section>
    </main>
  );
}
