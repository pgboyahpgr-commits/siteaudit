export default function TermsPage() {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>TERMS &amp; CONDITIONS</h2>
          <span className="small dim">Last updated: {new Date().getFullYear()}. Please read these terms carefully before using SiteAudit.</span>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>1. ACCEPTANCE OF TERMS</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            By accessing or using <strong>SiteAudit</strong> (&ldquo;the Service&rdquo;), you agree to be bound by these Terms
            and Conditions (&ldquo;Terms&rdquo;). If you do not agree with any part of these Terms, you must not use the
            Service. These Terms constitute a legally binding agreement between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;)
            and the operator of SiteAudit (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
          </p>
          <p className="small dim mt">
            We reserve the right to update these Terms at any time. Continued use of the Service after changes
            constitutes acceptance of the revised Terms. It is your responsibility to review this page periodically.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>2. DESCRIPTION OF SERVICE</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            SiteAudit is a <strong className="accent">website security, privacy, and trust scanner</strong>. The Service
            performs automated passive and active security assessments of websites, including but not limited to:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Web crawling and page discovery</li>
            <li>Security header and TLS certificate analysis</li>
            <li>Exposed file and secret detection</li>
            <li>API endpoint enumeration and probing</li>
            <li>CVE matching against detected technology versions</li>
            <li>AI-powered risk analysis and fix recommendations</li>
            <li>Visual trust assessment (VibeCheck)</li>
          </ul>
          <p className="small dim mt">
            The Service is provided on an <strong>&ldquo;as-is&rdquo;</strong> basis. We make no guarantees about scan
            accuracy, completeness, or timeliness. Features and functionality may change without notice.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>3. USER RESPONSIBILITIES</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            You are <strong>solely responsible</strong> for ensuring you have the legal right to scan any website you
            submit to the Service. By initiating a scan, you represent and warrant that:
          </p>
          <ol className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>You <strong className="accent">own the website</strong> being scanned, OR</li>
            <li>You have obtained <strong className="accent">explicit written permission</strong> from the website owner to test it.</li>
          </ol>
          <p className="small dim mt">
            You assume all legal liability for unauthorized scanning. We do not verify ownership claims at the point
            of passive scan initiation &mdash; you are trusted to answer the consent checkbox truthfully.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>4. CONSENT RECORDING</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            Every scan initiated through the Service records a <strong>consent acknowledgment</strong> that includes:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Your <span className="cyan">IP address</span> at the time of scan initiation</li>
            <li>A <span className="cyan">timestamp</span> (UTC) of when you checked the consent box</li>
            <li>The <span className="cyan">target URL</span> and scan mode selected</li>
            <li>Your explicit agreement that you own the site or have permission to test it</li>
          </ul>
          <p className="small dim mt">
            This record exists for legal compliance and may be retained indefinitely. By using the Service, you
            consent to this logging.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>5. PROHIBITED USES</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            You agree <strong>not</strong> to use the Service for any of the following:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li><span className="red">Unauthorized scanning</span> of websites you do not own or lack permission to test</li>
            <li><span className="red">Malicious or illegal activity</span> &mdash; including but not limited to hacking, data theft, denial-of-service, or reconnaissance for attacks</li>
            <li><span className="red">Bypassing access controls</span> or attempting to circumvent the consent mechanism</li>
            <li><span className="red">Automated abuse</span> &mdash; running excessive or scripted scans that degrade Service availability</li>
            <li><span className="red">Harassment or intimidation</span> using scan results against website operators</li>
            <li><span className="red">Resale or redistribution</span> of the Service or its reports as a commercial product without explicit license</li>
          </ul>
          <p className="small dim mt">
            We reserve the right to terminate access to the Service for any user who engages in prohibited activities,
            and to cooperate with law enforcement authorities in the investigation of illegal conduct.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>6. DISCLAIMER OF WARRANTIES</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            THE SERVICE IS PROVIDED <strong className="amber">&ldquo;AS IS&rdquo;</strong> AND &ldquo;AS AVAILABLE&rdquo;
            WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Warranties of <strong>merchantability</strong>, fitness for a particular purpose, or non-infringement</li>
            <li>Warranties that the Service will be <strong>uninterrupted</strong>, timely, secure, or error-free</li>
            <li>Warranties that scan results are <strong>accurate</strong>, reliable, or complete</li>
            <li>Warranties that identified issues represent the <strong>full security posture</strong> of a target</li>
          </ul>
          <p className="small dim mt">
            Scan results are advisory in nature. A clean scan does not guarantee a site is secure, and flagged issues
            may include false positives. Always verify findings independently before taking remedial action.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>7. LIMITATION OF LIABILITY</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            IN NO EVENT SHALL THE SERVICE OPERATORS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Loss of <strong>data</strong>, revenue, or business opportunity</li>
            <li>Damages resulting from <strong>reliance on scan reports</strong> or AI-generated analysis</li>
            <li>Damages from <strong>unauthorized access</strong> to or alteration of your transmissions or data</li>
            <li>Damages arising from <strong>third-party conduct</strong> or external services used by the Service</li>
            <li>Any damages exceeding the amount (if any) you paid for the Service during the 12 months preceding the claim</li>
          </ul>
          <p className="small dim mt">
            Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities.
            In such jurisdictions, our liability is limited to the maximum extent permitted by law.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>8. INDEMNIFICATION</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            You agree to indemnify, defend, and hold harmless the Service operators from any claims, damages,
            liabilities, costs, or expenses (including reasonable legal fees) arising from:
          </p>
          <ul className="small mt" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Your <strong>violation</strong> of these Terms</li>
            <li>Your <strong>unauthorized scanning</strong> of websites</li>
            <li>Your misuse of the Service for any <strong>illegal or prohibited</strong> purpose</li>
            <li>Any <strong>content</strong> you submit, transmit, or make available through the Service</li>
          </ul>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>9. INTELLECTUAL PROPERTY</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            The SiteAudit name, logo, source code, design, and analysis engine are protected by applicable copyright
            and intellectual property laws. You may not copy, modify, distribute, or create derivative works without
            explicit permission. Scan reports generated by the Service are for your personal or internal business use.
          </p>
          <p className="small dim mt">
            The Service is <strong className="cyan">open source</strong> and may be self-hosted. Self-hosted instances
            are subject to the terms of the project's open-source license and these Terms where applicable.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>10. TERMINATION</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            We may terminate or suspend your access to the Service immediately, without prior notice or liability, for
            any reason, including but not limited to a breach of these Terms. Upon termination, your right to use the
            Service will cease immediately. Provisions that by their nature should survive termination (including
            disclaimers, liability limitations, and indemnification) shall survive.
          </p>
        </div>
      </div>

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>11. CONTACT INFORMATION</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            For questions about these Terms, please open an issue on the project&rsquo;s GitHub repository or contact
            the maintainer through the contact information listed in the repository.
          </p>
          <p className="small dim mt">
            Last updated: {new Date().getFullYear()}. These Terms supersede all prior agreements and understandings
            relating to the Service.
          </p>
        </div>
      </div>

      <div className="legal-warn">
        ⚠ LEGAL NOTICE: Unauthorized scanning or security testing of websites without explicit written permission
        may violate applicable laws, including the Computer Fraud and Abuse Act (CFAA) in the United States and
        similar legislation in other jurisdictions. Always verify ownership or obtain permission before scanning.
      </div>
    </>
  );
}
