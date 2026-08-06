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
    tech: "WordPress",
    max: "5.2.4",
    cve: "CVE-2019-9787",
    cvss: "8.0 (High)",
    title: "WordPress path traversal leading to RCE",
    ref: "https://nvd.nist.gov/vuln/detail/CVE-2019-9787",
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
];

// tech name -> detector alias
const ALIASES = {
  "Powered by: Express": "Express",
  "WordPress": "WordPress",
  "JQuery": "jQuery",
  "jQuery": "jQuery",
  "AngularJS": "Angular",
  "Angular": "Angular",
  "Bootstrap": "Bootstrap",
  "Lodash": "Lodash",
  "PHP": "PHP",
  "Tailwind CSS": null,
  "React": null,
};

export function lookupCves(techList) {
  const out = [];
  for (const t of techList || []) {
    const alias = ALIASES[t.name] ?? t.name.split(" ")[0];
    if (!DB.some((r) => r.tech === alias)) continue;
    const version = t.version || t.name.match(/(\d+(?:\.\d+)+)/)?.[0];
    for (const row of DB) {
      if (row.tech !== alias) continue;
      if (version && cmpVersion(version, row.max) < 0) {
        out.push({
          ...row,
          detected: `${t.name} (${version})`,
        });
      }
    }
  }
  return out;
}
