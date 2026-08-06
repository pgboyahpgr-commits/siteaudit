export default function PrivacyPage() {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>PRIVACY POLICY</h2>
          <span className="small dim">How SiteAudit handles your data. Minimal, transparent, and secure by design.</span>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>1. DATA WE COLLECT</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            SiteAudit is designed to <strong className="accent">collect as little data as possible</strong>. We do not
            run analytics, tracking scripts, advertising networks, or third-party data collection tools. Here is
            everything we may record:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong className="cyan">Login credentials:</strong> If you create an account, we store your email address and a bcrypt-hashed password in our database. We never store plaintext passwords.</li>
            <li><strong className="cyan">Scan consent logs:</strong> As required by our Terms, every scan records your IP address and a timestamp confirming you agreed you own the site or have permission to test it.</li>
            <li><strong className="cyan">Scan reports:</strong> Scan results (findings, scores, metadata) are stored in your account so you can revisit past reports.</li>
            <li><strong className="cyan">JWT token:</strong> A single authentication token stored in your browser to keep you signed in across sessions.</li>
          </ul>
          <p className="small dim mt">
            <strong>That&rsquo;s it.</strong> We do not collect browsing history, personal identifiers, device fingerprints,
            location data, or any information beyond what is necessary for the Service to function.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>2. HOW WE USE YOUR DATA</span>
        </div>
        <div className="console-body">
          <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong>Authentication:</strong> Your email and hashed password are used solely to verify your identity when you sign in.</li>
            <li><strong>Scan history:</strong> Stored scan reports let you view past results and track security improvements over time.</li>
            <li><strong>Consent logs:</strong> IP and timestamp are retained for legal compliance &mdash; proving you accepted responsibility for the scan.</li>
            <li><strong>Service operation:</strong> Target URLs and scan parameters are processed to run security assessments.</li>
          </ul>
          <p className="small dim mt">
            We <strong className="red">never</strong> sell, rent, share, or monetize your data. No data is used for
            marketing, advertising, profiling, or any purpose beyond operating the Service.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>3. COOKIES &amp; LOCAL STORAGE</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            SiteAudit uses <strong className="cyan">one cookie only</strong>: the JWT authentication token that
            identifies your signed-in session. This is a functional, strictly necessary cookie required for the
            Service to operate &mdash; it is not used for tracking.
          </p>
          <p className="small mt" style={{ lineHeight: 1.75 }}>
            Additionally, your browser&rsquo;s <span className="cyan">localStorage</span> may be used to persist:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>AI API keys you configure on the Settings page (stored client-side only)</li>
            <li>Scan history snapshots for offline access to past results</li>
            <li>UI preferences (expanded/collapsed panels, filter states)</li>
          </ul>
          <p className="small dim mt">
            None of this localStorage data is sent to our servers unless you explicitly choose to push settings
            to the backend. You can clear it at any time through your browser settings.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>4. THIRD-PARTY SERVICES</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            SiteAudit is self-contained. We do <strong>not</strong> use:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><span className="red">&times;</span> Third-party analytics (no Google Analytics, Plausible, PostHog, etc.)</li>
            <li><span className="red">&times;</span> Advertising networks or ad tracking</li>
            <li><span className="red">&times;</span> Social media widgets or Facebook/Google login</li>
            <li><span className="red">&times;</span> External CDNs for assets (all assets are served from our domain)</li>
            <li><span className="red">&times;</span> Error tracking or session recording tools</li>
          </ul>
          <p className="small mt" style={{ lineHeight: 1.75 }}>
            If you configure your own <strong className="cyan">AI API keys</strong> (Gemini, OpenAI, Anthropic, etc.)
            on the Settings page, scan summaries may be sent to those providers for AI analysis. This is opt-in and
            controlled by you. If no external AI key is configured, the local analysis engine handles everything
            with zero external calls.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>5. DATA RETENTION</span>
        </div>
        <div className="console-body">
          <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong className="accent">Scan files &amp; temp data:</strong> Raw crawl files, fetched pages, and temporary analysis artifacts are automatically purged after processing completes. Only the structured report is retained.</li>
            <li><strong className="accent">Consent logs:</strong> IP + timestamp scan records are retained indefinitely for legal compliance.</li>
            <li><strong className="accent">Account data:</strong> Your email, hashed password, and saved scan reports are retained until you delete your account.</li>
            <li><strong className="accent">Account deletion:</strong> You may request account deletion at any time. All associated data (reports, credentials, logs) will be permanently removed within 30 days.</li>
          </ul>
          <p className="small dim mt">
            Scan reports stored in localStorage are under your control &mdash; they persist until you clear
            your browser storage or delete them through the Scan History page.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>6. DATA SECURITY</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            We implement reasonable technical and organizational measures to protect your data:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong>Passwords</strong> are salted and hashed using <span className="cyan">bcrypt</span> &mdash; even we cannot recover your original password</li>
            <li><strong>API keys</strong> in the Settings page are stored in your browser&rsquo;s localStorage and never sent to our server unless you explicitly push them</li>
            <li><strong>JWT tokens</strong> are signed with a server-side secret and expire automatically</li>
            <li><strong>Database</strong> uses SQLite with file-level access controls on the server</li>
            <li><strong>Verification tokens</strong> for Full Check are random, expire in 60 minutes, and are stored as SHA-256 hashes</li>
          </ul>
          <p className="small dim mt">
            No method of electronic storage is 100% secure. While we strive to protect your data, we cannot
            guarantee absolute security.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>7. YOUR RIGHTS</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            You have the right to:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><strong>Access</strong> your data &mdash; view your scan history and account details</li>
            <li><strong>Delete</strong> your data &mdash; remove individual scans or request full account deletion</li>
            <li><strong>Export</strong> your reports as JSON, CSV, or HTML for offline review</li>
            <li><strong>Withdraw consent</strong> &mdash; stop using the Service at any time</li>
            <li><strong>Be informed</strong> &mdash; this policy explains exactly what we collect and why</li>
          </ul>
          <p className="small dim mt">
            To exercise any of these rights, contact us through the project repository. We will respond to
            verified requests within 30 days.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>8. CHILDREN&rsquo;S PRIVACY</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            The Service is not intended for use by individuals under the age of 13. We do not knowingly collect
            personal information from children. If you believe a child has provided us with personal data, please
            contact us and we will delete it promptly.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>9. INTERNATIONAL TRANSFERS</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            SiteAudit is hosted and operated wherever the server is deployed. By using the Service, you acknowledge
            that your data may be processed in a country different from your own, which may have different data
            protection laws. We take steps to ensure your data receives an adequate level of protection regardless
            of where it is processed.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>10. POLICY UPDATES</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            We may update this Privacy Policy from time to time. Material changes will be communicated via a notice
            on the Service. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision.
            Continued use after changes constitutes acceptance.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>11. CONTACT</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            For privacy-related inquiries, data access requests, or account deletion, please open an issue on the
            project&rsquo;s GitHub repository or contact the maintainer directly.
          </p>
          <p className="small dim mt">
            We value your privacy and are committed to addressing concerns promptly and transparently.
          </p>
        </div>
      </div>

      <div className="legal-warn">
        ⚠ This policy applies to the SiteAudit service. Self-hosted instances may have different data handling
        practices depending on the operator&rsquo;s configuration. Check with your instance administrator for details.
      </div>
    </>
  );
}
