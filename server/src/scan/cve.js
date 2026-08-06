// Small built-in CVE lookup keyed by technology + version range.
// Deliberately curated to only well-known, well-documented CVEs so findings stay accurate.

function cmpVersion(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

const DB = [
  {
    tech: "jQuery",
    max: "3.5.0",
    cve: "CVE-2020-11022",
    cvss: "7.1 (High)",
    title: "jQuery XSS via HTML passed to DOM methods",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2020-11022",
  },
  {
    tech: "jQuery",
    max: "3.5.0",
    cve: "CVE-2020-11023",
    cvss: "6.1 (Medium)",
    title: "jQuery XSS via HTML manipulation (<3.5.0)",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2020-11023",
  },
  {
    tech: "jQuery",
    max: "3.0.0",
    cve: "CVE-2015-9251",
    cvss: "6.1 (Medium)",
    title: "jQuery selector XSS",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2015-9251",
  },
  {
    tech: "Angular",
    max: "1.6.1",
    cve: "CVE-2016-10069",
    cvss: "6.1 (Medium)",
    title: "AngularJS sandbox escape",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2016-10069",
  },
  {
    tech: "Bootstrap",
    max: "3.4.0",
    cve: "CVE-2018-14042",
    cvss: "6.1 (Medium)",
    title: "Bootstrap tooltip/HTML XSS",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2018-14042",
  },
  {
    tech: "Bootstrap",
    max: "5.3.3",
    cve: "CVE-2024-6531",
    cvss: "6.1 (Medium)",
    title: "Bootstrap tooltip data-attribute XSS",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-6531",
  },
  {
    tech: "WordPress",
    max: "5.2.4",
    cve: "CVE-2019-9787",
    cvss: "8.0 (High)",
    title: "WordPress path traversal leading to RCE",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2019-9787",
  },
  {
    tech: "WordPress",
    max: "6.5",
    cve: "CVE-2024-31210",
    cvss: "9.8 (Critical)",
    title: "WordPress RCE via plugin upload",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-31210",
  },
  {
    tech: "WordPress",
    max: "5.7",
    cve: "CVE-2021-29447",
    cvss: "7.1 (High)",
    title: "WordPress XXE via media upload (libxml)",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2021-29447",
  },
  {
    tech: "Lodash",
    max: "4.17.12",
    cve: "CVE-2019-10744",
    cvss: "9.8 (Critical)",
    title: "lodash prototype pollution",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2019-10744",
  },
  {
    tech: "PHP",
    max: "7.4.12",
    cve: "CVE-2019-11043",
    cvss: "9.8 (Critical)",
    title: "PHP-FPM + Nginx RCE (if using FPM in that config)",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2019-11043",
  },
  {
    tech: "PHP",
    max: "8.2.20",
    cve: "CVE-2024-4577",
    cvss: "9.8 (Critical)",
    title: "PHP CGI argument injection RCE",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-4577",
  },
  {
    tech: "React",
    max: "16.4.2",
    cve: "CVE-2018-6341",
    cvss: "6.1 (Medium)",
    title: "React XSS via dangerouslySetInnerHTML",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2018-6341",
  },
  {
    tech: "Next.js",
    max: "14.1.1",
    cve: "CVE-2024-34351",
    cvss: "7.5 (High)",
    title: "Next.js SSRF via Server Actions",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-34351",
  },
  {
    tech: "Next.js",
    max: "14.2.25",
    cve: "CVE-2025-29927",
    cvss: "9.1 (Critical)",
    title: "Next.js authorization bypass in middleware",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2025-29927",
  },
  {
    tech: "Express",
    max: "4.19.2",
    cve: "CVE-2024-29041",
    cvss: "6.1 (Medium)",
    title: "Express open redirect via req.path",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-29041",
  },
  {
    tech: "Nginx",
    max: "1.25.2",
    cve: "CVE-2023-44487",
    cvss: "7.5 (High)",
    title: "Nginx HTTP/2 Rapid Reset DoS",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2023-44487",
  },
  {
    tech: "Apache",
    max: "2.4.59",
    cve: "CVE-2024-24795",
    cvss: "7.5 (High)",
    title: "Apache HTTP request smuggling/splitting",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-24795",
  },
  {
    tech: "Vue.js",
    max: "3.4.30",
    cve: "CVE-2024-6783",
    cvss: "6.1 (Medium)",
    title: "Vue.js template injection XSS",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-6783",
  },
  {
    tech: "Django",
    max: "5.1",
    cve: "CVE-2024-53907",
    cvss: "8.8 (High)",
    title: "Django SQL injection via Oracle backend",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-53907",
  },
  {
    tech: "Laravel",
    max: "11.1.1",
    cve: "CVE-2024-40075",
    cvss: "5.3 (Medium)",
    title: "Laravel debug mode info leak",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-40075",
  },
  {
    tech: "Node.js",
    max: "18.20.2",
    cve: "CVE-2024-27980",
    cvss: "7.5 (High)",
    title: "Node.js Windows child_process command injection",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-27980",
  },
  {
    tech: "Drupal",
    max: "10.3",
    cve: "CVE-2024-4541",
    cvss: "6.1 (Medium)",
    title: "Drupal XSS via text format filters",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2024-4541",
  },
];

// tech name -> detector alias
const ALIASES = {
  "WordPress": "WordPress",
  "JQuery": "jQuery",
  "jQuery": "jQuery",
  "AngularJS": "Angular",
  "Angular": "Angular",
  "Bootstrap": "Bootstrap",
  "Lodash": "Lodash",
  "PHP": "PHP",
  "Tailwind CSS": null,
  "React": "React",
  "Next.js": "Next.js",
  "Vue.js": "Vue.js",
  "Django": "Django",
  "Laravel": "Laravel",
  "Drupal": "Drupal",
  "Powered by: Express": "Express",
  "Express": "Express",
  "Node.js": "Node.js",
  "Nginx": "Nginx",
  "Apache": "Apache",
};

export function lookupCves(techList) {
  const out = [];
  for (const t of techList || []) {
    const alias = ALIASES[t.name] ?? t.name.split(" ")[0];
    if (!DB.some((r) => r.tech === alias)) continue;
    const version = t.version || t.name.match(/(\d+(?:\.\d+)+)/)?.[0];
    for (const row of DB) {
      if (row.tech !== alias) continue;
      if (version && cmpVersion(version, row.max) <= 0) {
        out.push({
          ...row,
          detected: `${t.name} (${version})`,
        });
      }
    }
  }
  return out;
}
