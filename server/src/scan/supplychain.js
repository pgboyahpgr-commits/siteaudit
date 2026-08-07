import { httpGet } from "./http.js";
import { createHash } from "node:crypto";

const CDN_CVES = {
  "jquery": [
    { maxVersion: "3.5.0", cve: "CVE-2020-11022", cvss: "7.1", title: "jQuery XSS via HTML passed to DOM methods" },
    { maxVersion: "3.5.0", cve: "CVE-2020-11023", cvss: "6.1", title: "jQuery XSS via HTML manipulation" },
    { maxVersion: "3.0.0", cve: "CVE-2015-9251", cvss: "6.1", title: "jQuery selector XSS" },
  ],
  "bootstrap": [
    { maxVersion: "3.4.0", cve: "CVE-2018-14042", cvss: "6.1", title: "Bootstrap tooltip/HTML XSS" },
    { maxVersion: "5.3.3", cve: "CVE-2024-6531", cvss: "6.1", title: "Bootstrap tooltip data-attribute XSS" },
  ],
  "lodash": [
    { maxVersion: "4.17.12", cve: "CVE-2019-10744", cvss: "9.8", title: "lodash prototype pollution" },
    { maxVersion: "4.17.21", cve: "CVE-2021-23337", cvss: "7.2", title: "lodash template injection" },
  ],
  "moment": [
    { maxVersion: "2.29.4", cve: "CVE-2022-31129", cvss: "7.5", title: "moment.js ReDoS vulnerability" },
  ],
  "axios": [
    { maxVersion: "1.7.4", cve: "CVE-2024-39338", cvss: "7.5", title: "axios SSRF via server-side URL parsing" },
  ],
  "dompurify": [
    { maxVersion: "3.1.3", cve: "CVE-2024-45801", cvss: "7.1", title: "DOMPurify prototype pollution bypass" },
  ],
  "highlight.js": [
    { maxVersion: "11.9.0", cve: "CVE-2024-27308", cvss: "5.3", title: "highlight.js DOM Clobbering" },
  ],
  "socket.io": [
    { maxVersion: "4.7.5", cve: "CVE-2024-38355", cvss: "7.3", title: "Socket.IO unauthenticated event access" },
  ],
  "prismjs": [
    { maxVersion: "1.29.0", cve: "CVE-2023-28111", cvss: "6.1", title: "PrismJS DOM-based XSS" },
  ],
};

const JS_VERSION_RE = [
  { name: "jQuery", re: /jQuery\s+v?(\d+\.\d+\.\d+)/i, key: "jquery" },
  { name: "jQuery", re: /jquery[.-](\d+\.\d+\.\d+)/i, key: "jquery" },
  { name: "Bootstrap", re: /Bootstrap\s+v?(\d+\.\d+\.\d+)/i, key: "bootstrap" },
  { name: "Bootstrap", re: /bootstrap[.-](\d+\.\d+\.\d+)/i, key: "bootstrap" },
  { name: "Lodash", re: /lodash[.-](\d+\.\d+\.\d+)/i, key: "lodash" },
  { name: "Moment.js", re: /moment(?:\.min)?\.js\/(\d+\.\d+\.\d+)/i, key: "moment" },
  { name: "Moment.js", re: /moment\.version\s*=\s*["'](\d+\.\d+\.\d+)/i, key: "moment" },
  { name: "Axios", re: /axios\/(\d+\.\d+\.\d+)/i, key: "axios" },
  { name: "DOMPurify", re: /dompurify[.-](\d+\.\d+\.\d+)/i, key: "dompurify" },
  { name: "Highlight.js", re: /highlight\.js[.\s]*(\d+\.\d+\.\d+)/i, key: "highlight.js" },
  { name: "Socket.IO", re: /socket\.io[.-](\d+\.\d+\.\d+)/i, key: "socket.io" },
  { name: "PrismJS", re: /prism[.-](\d+\.\d+\.\d+)/i, key: "prismjs" },
  { name: "React", re: /react\/umd\/react\.(?:production|development)\.min\.js\?(\d+\.\d+\.\d+)/i, key: "react" },
  { name: "Vue.js", re: /vue[.-](\d+\.\d+\.\d+)/i, key: "vue" },
];

function cmpVer(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

export async function auditJsSupplyChain(jsFiles, pages) {
  const scripts = [...new Set(jsFiles)];
  const results = [];
  const seen = new Set();

  // Detect versions from JS URLs and page HTML
  for (const src of scripts) {
    const fileName = src.split("/").pop() || src;
    if (seen.has(fileName)) continue;
    seen.add(fileName);

    const entry = { src, lib: null, version: null, cves: [], sri: null };

    // Try version detection from filename
    for (const { name, re, key } of JS_VERSION_RE) {
      const match = fileName.match(re);
      if (match) {
        entry.lib = name;
        entry.version = match[1];
        entry.key = key;
        break;
      }
    }

    // Compute SRI hash if it's a CDN resource
    if (entry.src.startsWith("http") && (entry.src.includes("cdn.") || entry.src.includes("cdnjs") || entry.src.includes("jsdelivr") || entry.src.includes("unpkg") || entry.src.includes("cloudflare"))) {
      try {
        const res = await httpGet(entry.src, { timeout: 8000 });
        if (res.ok && res.text) {
          const hash = createHash("sha384").update(res.text).digest("base64");
          entry.sri = `sha384-${hash}`;
        }
      } catch {}
    }

    // Check CVEs
    if (entry.key && entry.version) {
      const cves = CDN_CVES[entry.key] || [];
      for (const cve of cves) {
        if (cmpVer(entry.version, cve.maxVersion) <= 0) {
          entry.cves.push(cve);
        }
      }
    }

    if (entry.lib || entry.cves.length || entry.sri) {
      results.push(entry);
    }
  }

  // Also scan page HTML for inline script patterns
  for (const page of pages.slice(0, 10)) {
    const html = page.html || "";
    for (const { name, re, key } of JS_VERSION_RE) {
      const match = html.match(re);
      if (match && !results.some(r => r.key === key)) {
        results.push({
          src: page.url,
          lib: name,
          version: match[1],
          key,
          cves: [],
          sri: null,
          source: "html",
        });
      }
    }
  }

  return results;
}
