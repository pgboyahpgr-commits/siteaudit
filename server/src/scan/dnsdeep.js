import dns from "node:dns/promises";

export async function checkDnsDeep(hostname) {
  const results = {
    spf: { present: false, records: [], issues: [], raw: "" },
    dkim: { present: false, selectors: [], issues: [] },
    dmarc: { present: false, policy: null, pct: null, rua: null, ruf: null, issues: [], raw: "" },
    caa: { present: false, records: [], issues: [] },
    mx: { records: [], issues: [] },
    allRecords: { A: [], AAAA: [], MX: [], TXT: [], CNAME: [], NS: [], SOA: null, SRV: [], CAA: [] },
  };

  // ── Full DNS enumeration ──
  try { results.allRecords.A = await dns.resolve4(hostname); } catch {}
  try { results.allRecords.AAAA = await dns.resolve6(hostname); } catch {}
  try { results.allRecords.NS = await dns.resolveNs(hostname); } catch {}
  try { results.allRecords.CNAME = await dns.resolveCname(hostname); } catch {}
  try {
    const soa = await dns.resolveSoa(hostname);
    results.allRecords.SOA = { nsname: soa.nsname, hostmaster: soa.hostmaster, serial: soa.serial, refresh: soa.refresh, retry: soa.retry, expire: soa.expire, minttl: soa.minttl };
  } catch {}

  // ── MX records ──
  try {
    const mxRecords = await dns.resolveMx(hostname);
    results.allRecords.MX = mxRecords.sort((a, b) => a.priority - b.priority);
    results.mx.records = mxRecords;
    if (!mxRecords.length) results.mx.issues.push("No MX records — cannot receive email");
  } catch { results.mx.issues.push("No MX records found (NXDOMAIN or error)"); }

  // ── TXT / SPF / DKIM / DMARC ──
  try {
    const txtRecords = await dns.resolveTxt(hostname);
    results.allRecords.TXT = txtRecords.map(r => r.join(""));

    for (const txt of results.allRecords.TXT) {
      const s = txt.trim();
      // SPF
      if (/^v=spf1\b/i.test(s)) {
        results.spf.present = true;
        results.spf.records.push(s);
        results.spf.raw = s;
        const parts = s.split(/\s+/);
        const all = parts[parts.length - 1];
        if (all === "-all") results.spf.mode = "hardfail";
        else if (all === "~all") results.spf.mode = "softfail";
        else if (all === "?all") results.spf.mode = "neutral";
        else if (all === "+all") results.spf.issues.push("SPF ends with +all — allows ANY server to send mail!");
        else results.spf.issues.push("SPF missing final 'all' mechanism");

        const includes = parts.filter(p => p.startsWith("include:"));
        if (includes.length > 10) results.spf.issues.push(`SPF has ${includes.length} includes — DNS lookups limited to 10`);

        if (/\bredirect=/.test(s) && includes.length > 9) results.spf.issues.push("SPF uses redirect with many includes — may exceed 10-lookup limit");
      }

      // DMARC
      if (/^v=dmarc1\b/i.test(s)) {
        results.dmarc.present = true;
        results.dmarc.raw = s;
        const policyMatch = s.match(/p=(reject|quarantine|none)/i);
        if (policyMatch) results.dmarc.policy = policyMatch[1].toLowerCase();
        const pctMatch = s.match(/pct=(\d+)/i);
        if (pctMatch) results.dmarc.pct = parseInt(pctMatch[1]);
        const ruaMatch = s.match(/rua=([^;]+)/i);
        if (ruaMatch) results.dmarc.rua = ruaMatch[1].trim();
        const rufMatch = s.match(/ruf=([^;]+)/i);
        if (rufMatch) results.dmarc.ruf = rufMatch[1].trim();
        const ruaMatches = s.match(/rua=([^;]+)/gi);
        if (ruaMatches && ruaMatches.length > 2) results.dmarc.issues.push("Multiple rua= present — exceeding typical limits");

        if (results.dmarc.policy === "none") results.dmarc.issues.push("DMARC policy is 'none' — no enforcement, monitoring only");
        if (s.includes("sp=none") || !s.match(/sp=([^;]+)/i)) results.dmarc.issues.push("No subdomain policy set — subdomains may bypass DMARC");
        if (!s.match(/fo=1/i)) results.dmarc.issues.push("Forensic reporting (fo=1) not enabled — harder to debug failures");
        if (!results.dmarc.rua) results.dmarc.issues.push("No aggregate report address (rua) — can't monitor abuse");
      }
    }
  } catch {}

  if (!results.spf.present) results.spf.issues.push("No SPF record found — email can be spoofed from any server");
  if (!results.dmarc.present) results.dmarc.issues.push("No DMARC record found — no policy enforcement for email spoofing");

  // ── DKIM (check common selectors) ──
  const dkimSelectors = ["google", "default", "dkim", "selector1", "selector2", "s1", "s2", "k1", "mail", "sendgrid", "protonmail", "mta", "zendesk", "hubspot"];
  for (const sel of dkimSelectors) {
    try {
      const dkimTxt = await dns.resolveTxt(`${sel}._domainkey.${hostname}`);
      results.dkim.present = true;
      const record = dkimTxt.flat().join("");
      results.dkim.selectors.push({ selector: sel, record: record.slice(0, 200), keyLength: (record.match(/p=([A-Za-z0-9+/=]+)/) || [])[1]?.length || 0 });
      if (results.dkim.selectors.length >= 4) break;
    } catch {}
  }
  if (!results.dkim.present) results.dkim.issues.push("No DKIM selectors found for common names — email may not be authenticated");

  // ── CAA records ──
  try {
    const caaRecords = await dns.resolveCaa(hostname);
    results.allRecords.CAA = caaRecords;
    results.caa.present = true;
    results.caa.records = caaRecords.map(r => `${r.flag} ${r.tag} "${r.value}"`);
    const issuers = caaRecords.filter(r => r.tag === "issue");
    if (!issuers.length) results.caa.issues.push("No CAA 'issue' records — any CA can issue certificates");
    const wildcard = issuers.find(r => r.value === ";");
    if (wildcard) results.caa.issues.push("CAA allows any CA (issue \";\") — no restriction");
    const mail = caaRecords.filter(r => r.tag === "iodef");
    if (!mail.length) results.caa.issues.push("No CAA iodef record — no notification if unauthorized cert is issued");
  } catch {
    results.caa.issues.push("No CAA records — any CA can issue certificates for this domain");
  }

  return results;
}

export function generateDnsFixes(hostname, dnsInfo, findings) {
  const fixRecords = [];

  // SPF fix
  if (!dnsInfo.spf.present) {
    fixRecords.push({
      type: "TXT",
      name: hostname,
      value: "v=spf1 mx -all",
      description: "Basic SPF record: allow MX servers, hard-fail everything else",
    });
  } else if (dnsInfo.spf.mode !== "hardfail") {
    fixRecords.push({
      type: "TXT",
      name: hostname,
      value: "v=spf1 mx -all",
      description: "Replace softfail/neutral with hardfail (-all) for strict enforcement",
    });
  }

  // DMARC fix
  if (!dnsInfo.dmarc.present || dnsInfo.dmarc.policy !== "reject") {
    fixRecords.push({
      type: "TXT",
      name: `_dmarc.${hostname}`,
      value: "v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@REPLACE_ME; fo=1",
      description: "Strict DMARC with rejection policy and aggregate reporting",
    });
  }

  // DKIM note
  if (!dnsInfo.dkim.present) {
    fixRecords.push({
      type: "NOTE",
      name: "DKIM setup",
      value: `Generate DKIM keypair via your email provider or 'openssl genrsa -out dkim.key 2048 ; openssl rsa -in dkim.key -pubout'. Publish public key in TXT record: selector._domainkey.${hostname}`,
      description: "DKIM signs outgoing email so receivers can verify authenticity",
    });
  }

  // CAA fix
  if (!dnsInfo.caa.present) {
    fixRecords.push({
      type: "CAA",
      name: hostname,
      value: '0 issue "letsencrypt.org"',
      description: "Restrict certificate issuance to Let's Encrypt only",
    });
  }

  return fixRecords;
}
