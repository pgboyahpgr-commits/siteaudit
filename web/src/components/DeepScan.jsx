import { useState, useMemo } from "react";

function scoreColor(score) {
  if (score == null) return "var(--dim)";
  if (score >= 90) return "var(--green)";
  if (score >= 70) return "var(--cyan)";
  if (score >= 50) return "var(--amber)";
  return "var(--red)";
}

function scoreBadge(score) {
  const c = scoreColor(score);
  const label = score >= 90 ? "PASS" : score >= 70 ? "OK" : score >= 50 ? "WARN" : "FAIL";
  return { color: c, label };
}

function htmlTagAttrs(raw, tag) {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    results.push(m[1]);
  }
  return results;
}

function extractAttr(attrsStr, name) {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = attrsStr.match(re);
  return m ? m[1] : null;
}

function extractSrcs(raw, tag) {
  return htmlTagAttrs(raw, tag)
    .map((a) => extractAttr(a, "src"))
    .filter(Boolean);
}

function extractHrefs(raw, tag) {
  return htmlTagAttrs(raw, tag)
    .map((a) => extractAttr(a, "href"))
    .filter(Boolean);
}

function extractEls(raw, el) {
  const re = new RegExp(`<${el}\\b[^>]*>`, "gi");
  const m = raw.match(re);
  return m || [];
}

function extractInnerStyle(raw) {
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const results = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    results.push(m[1]);
  }
  return results;
}

function extractHeadTag(raw, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\/${tag}>`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function extractMeta(raw, nameOrProp) {
  const attr = nameOrProp.startsWith("og:") || nameOrProp.startsWith("twitter:") ? "property" : "name";
  const re = new RegExp(`<meta\\b[^>]*${attr}\\s*=\\s*["']${nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "gi");
  return re.test(raw);
}

function extractMetaContent(raw, nameOrProp) {
  const attr = nameOrProp.startsWith("og:") || nameOrProp.startsWith("twitter:") ? "property" : "name";
  const re = new RegExp(`<meta\\b[^>]*${attr}\\s*=\\s*["']${nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i");
  const m = raw.match(re);
  return m ? m[1] : null;
}

function extractTitle(raw) {
  const m = raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function countTags(raw) {
  const m = raw.match(/<\w+/gi);
  return m ? m.length : 0;
}

function parseEmail(raw) {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const m = raw.match(re);
  return m || [];
}

function parseDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function crawlPages(meta) {
  return meta?.pagesCrawled || [];
}

function jsFiles(meta) {
  return meta?.jsFiles || [];
}

function techList(meta) {
  return meta?.tech || [];
}

function services(meta) {
  return meta?.services || [];
}

/* ──────────────────────────────────────────────
   ENGINE 1 — JS Bundle Analyzer
   ────────────────────────────────────────────── */
function engineJSBundles(meta) {
  const files = jsFiles(meta);
  const findings = [];
  let heavyCount = 0;
  let minifiedCount = 0;
  let unminifiedCount = 0;
  let estimatedKB = 0;
  const libVersions = [];
  const libPatterns = [
    { re: /react(?:-dom)?[.\-_](\d+\.\d+\.\d+)/i, name: "React" },
    { re: /vue[.\-_](\d+\.\d+\.\d+)/i, name: "Vue" },
    { re: /jquery[.\-_](\d+\.\d+\.\d+)/i, name: "jQuery" },
    { re: /lodash[.\-_](\d+\.\d+\.\d+)/i, name: "Lodash" },
    { re: /moment[.\-_](\d+\.\d+\.\d+)/i, name: "Moment.js" },
    { re: /d3[.\-_](\d+\.\d+\.\d+)/i, name: "D3" },
    { re: /chart[.\-_](\d+\.\d+\.\d+)/i, name: "Chart.js" },
    { re: /angular[.\-_](\d+\.\d+\.\d+)/i, name: "Angular" },
  ];

  files.forEach((f) => {
    const filename = typeof f === "string" ? f : f.url || f;
    if (/\.min\./i.test(filename)) {
      minifiedCount++;
    } else {
      unminifiedCount++;
    }
    const weight = typeof f === "object" ? f.size || f.kb || 0 : 0;
    estimatedKB += weight;
    if (weight > 100 || (typeof f === "string" && f.length > 80)) {
      heavyCount++;
      findings.push({ type: "heavy", file: filename, detail: `Estimated ${weight > 0 ? weight + "KB" : "large"}` });
    }
    libPatterns.forEach((p) => {
      const m = filename.match(p.re);
      if (m) libVersions.push(`${p.name} ${m[1]}`);
    });
  });

  if (unminifiedCount > 0)
    findings.push({ type: "unminified", count: unminifiedCount, detail: `${unminifiedCount} unminified JS files found (harder to cache, larger payload)` });
  if (files.length === 0)
    findings.push({ type: "none", detail: "No JS files detected in crawl" });

  const score = files.length === 0 ? 100 : heavyCount > 3 ? 50 : heavyCount > 0 ? 70 : unminifiedCount > 2 ? 65 : 100;
  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: heavyCount > 0 ? ["Consider code-splitting heavy bundles (>100KB)"] : [],
    detail: { total: files.length, estimatedKB, heavyCount, minifiedCount, unminifiedCount, libVersions },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 2 — CSS Selector Complexity
   ────────────────────────────────────────────── */
function engineCSSComplexity(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let totalImportant = 0;
  let deepSelectors = 0;
  let universalSelectors = 0;
  let idSelectors = 0;

  pages.forEach((p) => {
    const html = p.html || "";
    const styleBlocks = extractInnerStyle(html);
    styleBlocks.forEach((css) => {
      const impMatches = css.match(/!important/gi);
      if (impMatches) totalImportant += impMatches.length;
      const uniMatches = css.match(/\*(?![\w-])/g);
      if (uniMatches) universalSelectors += uniMatches.length;
      const idMatches = css.match(/#[a-zA-Z][\w-]*/g);
      if (idMatches) idSelectors += idMatches.length;

      const blocks = css.split(/\{/);
      blocks.forEach((b) => {
        const sel = b.replace(/\}[\s\S]*$/, "").trim();
        const depth = (sel.match(/>/g) || []).length;
        if (depth > 3) deepSelectors++;
      });
    });
  });

  if (totalImportant > 5) findings.push({ type: "important", count: totalImportant, detail: `${totalImportant} !important overrides found — specificity wars` });
  if (deepSelectors > 3) findings.push({ type: "deep", count: deepSelectors, detail: `${deepSelectors} selectors with >3 nesting levels` });
  if (universalSelectors > 5) findings.push({ type: "universal", count: universalSelectors, detail: `${universalSelectors} universal * selector usages` });
  if (idSelectors > 5) findings.push({ type: "ids", count: idSelectors, detail: `${idSelectors} ID selectors (bad for reusability)` });

  const score = totalImportant > 20 ? 30 : totalImportant > 5 ? 50 : deepSelectors > 10 ? 40 : deepSelectors > 3 ? 60 : universalSelectors > 10 ? 55 : 100;
  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: totalImportant > 5 ? ["Reduce !important usage — rely on specificity instead"] : [],
    detail: { totalImportant, deepSelectors, universalSelectors, idSelectors },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 3 — Auto-Generated CSP Policy
   ────────────────────────────────────────────── */
function engineCSP(meta) {
  const pages = crawlPages(meta);
  const scriptSrcs = new Set();
  const styleSrcs = new Set();
  const fontSrcs = new Set();
  const imgSrcs = new Set();
  const connectSrcs = new Set();
  const frameSrcs = new Set();

  pages.forEach((p) => {
    const html = p.html || "";
    extractSrcs(html, "script").forEach((s) => {
      try { scriptSrcs.add(new URL(s, p.url || meta?.targetUrl || "http://localhost").origin); } catch { scriptSrcs.add(parseDomain(s)); }
    });
    extractHrefs(html, "link").forEach((h) => {
      const domain = parseDomain(h);
      const lower = h.toLowerCase();
      if (lower.includes(".css") || lower.includes("stylesheet")) styleSrcs.add(domain);
      if (lower.includes(".woff") || lower.includes(".ttf") || lower.includes(".eot")) fontSrcs.add(domain);
    });
    extractSrcs(html, "img").forEach((s) => {
      try { imgSrcs.add(new URL(s, p.url || meta?.targetUrl || "http://localhost").origin); } catch { }
    });
    const xhrRe = /fetch\(["']([^"']*)["']\)|\.get\(["']([^"']*)["']\)|\.post\(["']([^"']*)["']\)/gi;
    let xm;
    while ((xm = xhrRe.exec(html)) !== null) {
      const url = xm[1] || xm[2] || xm[3];
      try { connectSrcs.add(new URL(url, p.url || "http://localhost").origin); } catch { }
    }
    const iframeSrcs = extractSrcs(html, "iframe");
    iframeSrcs.forEach((s) => {
      try { frameSrcs.add(new URL(s, p.url || "http://localhost").origin); } catch { frameSrcs.add(parseDomain(s)); }
    });
  });

  scriptSrcs.add("'self'");
  scriptSrcs.add("'unsafe-inline'");
  styleSrcs.add("'self'");
  styleSrcs.add("'unsafe-inline'");
  fontSrcs.add("'self'");
  imgSrcs.add("'self'");
  imgSrcs.add("data:");
  connectSrcs.add("'self'");
  frameSrcs.add("'self'");

  const csp = [
    `default-src 'self';`,
    `script-src ${[...scriptSrcs].join(" ")};`,
    `style-src ${[...styleSrcs].join(" ")};`,
    `img-src ${[...imgSrcs].join(" ")};`,
    `font-src ${[...fontSrcs].join(" ")};`,
    `connect-src ${[...connectSrcs].join(" ")};`,
    `frame-src ${[...frameSrcs].join(" ")};`,
  ].join(" ");

  return {
    score: pages.length > 0 ? 85 : 60,
    passed: true,
    findings: [{ type: "csp", detail: `Generated CSP with ${scriptSrcs.size} script origins, ${styleSrcs.size} style origins` }],
    recommendations: ["Apply the generated CSP to your server headers or <meta> tag"],
    detail: { cspString: csp },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 4 — Email Security Config
   ────────────────────────────────────────────── */
function engineEmailSecurity(meta) {
  const dns = meta?.dns || {};
  const findings = [];
  let spf = false;
  let dkim = false;
  let dmarc = false;

  const txtRecords = dns.txt || [];
  txtRecords.forEach((r) => {
    if (typeof r === "string") {
      if (/v=spf1/i.test(r)) spf = true;
      if (/v=DKIM1/i.test(r)) dkim = true;
      if (/v=DMARC1/i.test(r)) dmarc = true;
    }
  });

  if (!spf) findings.push({ type: "missing-spf", detail: "No SPF record found — email spoofing possible" });
  if (!dkim) findings.push({ type: "missing-dkim", detail: "No DKIM record found — emails cannot be verified" });
  if (!dmarc) findings.push({ type: "missing-dmarc", detail: "No DMARC record found — missing reporting & enforcement" });

  const domain = meta?.targetUrl ? parseDomain(meta.targetUrl) : "example.com";
  const score = (spf ? 33 : 0) + (dkim ? 33 : 0) + (dmarc ? 34 : 0);
  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: [
      !spf && `Add SPF TXT record: v=spf1 include:_spf.${domain} ~all`,
      !dkim && `Generate DKIM key and add selector._domainkey.${domain} TXT record: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY`,
      !dmarc && `Add DMARC TXT record (_dmarc.${domain}): v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    ].filter(Boolean),
    detail: { spf, dkim, dmarc },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 5 — Security.txt Generator
   ────────────────────────────────────────────── */
function engineSecurityTxt(meta, findingsArr) {
  const pages = crawlPages(meta);
  let allHtml = pages.map((p) => p.html || "").join("\n");
  const emails = parseEmail(allHtml);
  let contact = "security@example.com";
  const securityEmails = emails.filter((e) => /security|admin|contact|info|abuse|support/i.test(e));
  if (securityEmails.length > 0) contact = securityEmails[0];
  else if (emails.length > 0) contact = emails[0];

  const targetUrl = meta?.targetUrl || "https://example.com";
  const expires = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

  const groups = {};
  if (findingsArr) {
    findingsArr.forEach((f) => {
      const cat = f.category || "general";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f.title || f.description || "");
    });
  }

  const lines = [
    "Contact: " + contact,
    "Expires: " + expires,
    "Canonical: " + targetUrl + "/.well-known/security.txt",
    "Preferred-Languages: en",
    "",
    "# Generated by SiteAudit Deep Scan",
    "# This file should be placed at: " + targetUrl + "/.well-known/security.txt",
    "",
    "# Acknowledged vulnerabilities by category:",
  ];
  Object.entries(groups).slice(0, 5).forEach(([cat, items]) => {
    lines.push(`# ${cat}: ${items.slice(0, 3).join("; ")}`);
  });

  return {
    score: 100,
    passed: true,
    findings: [{ type: "securitytxt", detail: `Generated with contact ${contact}, expires ${expires}` }],
    recommendations: ["Place security.txt at /.well-known/security.txt on your server"],
    detail: { securityTxt: lines.join("\n"), contact, expires },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 6 — Broken Resource Detector
   ────────────────────────────────────────────── */
function engineBrokenResources(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let totalResources = 0;
  let brokenCount = 0;
  const brokenExamples = [];

  pages.forEach((p) => {
    const html = p.html || "";
    const status = p.status || 200;
    const imgSrcs = extractSrcs(html, "img");
    const scriptSrcs = extractSrcs(html, "script");
    const linkHrefs = extractHrefs(html, "link");

    [...imgSrcs, ...scriptSrcs, ...linkHrefs].forEach((url) => {
      totalResources++;
      if (typeof p.brokenResources === "object") {
        const broken = p.brokenResources || {};
        if (broken[url]) {
          brokenCount++;
          if (brokenExamples.length < 5) brokenExamples.push({ url, status: broken[url] });
        }
      }
    });
    if (status >= 400) {
      brokenCount++;
      if (brokenExamples.length < 5) brokenExamples.push({ url: p.url, status });
    }
  });

  if (totalResources === 0) {
    return { score: 100, passed: true, findings: [{ type: "none", detail: "No resources to analyze" }], recommendations: [], detail: { totalResources: 0, brokenCount: 0, brokenExamples: [] } };
  }

  const percent = Math.round((brokenCount / totalResources) * 100);
  const score = percent > 10 ? 30 : percent > 5 ? 50 : percent > 1 ? 70 : 100;

  if (brokenCount > 0) findings.push({ type: "broken", count: brokenCount, total: totalResources, detail: `${brokenCount}/${totalResources} resources returned non-200 status (${percent}%)` });

  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: brokenCount > 0 ? ["Replace or remove broken resource URLs", "Set up a 404 monitor or link checker"] : [],
    detail: { totalResources, brokenCount, brokenExamples },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 7 — Semantic HTML Auditor
   ────────────────────────────────────────────── */
function engineSemanticHTML(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let hasH1 = false, hasH2 = false, hasH3 = false;
  let hasMain = false, hasNav = false, hasArticle = false, hasSection = false, hasAside = false;
  let headingIssues = 0;

  pages.forEach((p) => {
    const html = p.html || "";
    if (/<h1\b/i.test(html)) hasH1 = true;
    if (/<h2\b/i.test(html)) hasH2 = true;
    if (/<h3\b/i.test(html)) hasH3 = true;
    if (/<main\b/i.test(html)) hasMain = true;
    if (/<nav\b/i.test(html)) hasNav = true;
    if (/<article\b/i.test(html)) hasArticle = true;
    if (/<section\b/i.test(html)) hasSection = true;
    if (/<aside\b/i.test(html)) hasAside = true;

    const hTags = html.match(/<\/?h[1-6]\b/gi) || [];
    if (hTags.length > 0) {
      const order = [];
      hTags.forEach((t) => {
        const n = parseInt(t.match(/\d/)[0]);
        if (order.length > 0 && n > order[order.length - 1] + 1 && !t.startsWith("</")) {
          headingIssues++;
        }
        if (!t.startsWith("</")) order.push(n);
      });
    }
  });

  let score = 100;
  if (!hasH1) { score -= 25; findings.push({ type: "missing-h1", detail: "No <h1> element — critical for SEO and accessibility" }); }
  if (!hasH2 && hasH1) { score -= 10; findings.push({ type: "missing-h2", detail: "Has <h1> but no <h2> — incomplete heading hierarchy" }); }
  if (!hasMain) { score -= 20; findings.push({ type: "missing-main", detail: "No <main> landmark — screen-reader users have no content target" }); }
  if (!hasNav) { score -= 10; findings.push({ type: "missing-nav", detail: "No <nav> landmark" }); }
  if (headingIssues > 0) { score -= 10; findings.push({ type: "heading-order", count: headingIssues, detail: `${headingIssues} heading order violations detected` }); }

  const bonus = (hasArticle ? 3 : 0) + (hasSection ? 3 : 0) + (hasAside ? 4 : 0);
  score = Math.min(100, Math.max(0, score + bonus));

  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: !hasMain ? ["Add a <main> element wrapping your primary content"] : [],
    detail: { hasH1, hasH2, hasH3, hasMain, hasNav, hasArticle, hasSection, hasAside, headingIssues },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 8 — Meta Tag Completeness
   ────────────────────────────────────────────── */
function engineMetaTags(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  if (pages.length === 0) {
    return { score: 0, passed: false, findings: [{ type: "none", detail: "No crawled pages to check" }], recommendations: [], detail: {} };
  }
  const html = pages.map((p) => p.html || "").join("\n");
  const checks = [
    { key: "title", label: "<title>", present: !!extractTitle(html) },
    { key: "description", label: "<meta description>", present: extractMeta(html, "description") },
    { key: "viewport", label: "<meta viewport>", present: extractMeta(html, "viewport") },
    { key: "og:title", label: "og:title", present: extractMeta(html, "og:title") },
    { key: "og:description", label: "og:description", present: extractMeta(html, "og:description") },
    { key: "og:image", label: "og:image", present: extractMeta(html, "og:image") },
    { key: "og:url", label: "og:url", present: extractMeta(html, "og:url") },
    { key: "twitter:card", label: "twitter:card", present: extractMeta(html, "twitter:card") },
  ];

  const missing = checks.filter((c) => !c.present);
  const found = checks.filter((c) => c.present);
  missing.forEach((c) => findings.push({ type: "missing", key: c.key, detail: `${c.label} is missing` }));

  const score = Math.round((found.length / checks.length) * 100);
  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: missing.length > 0 ? ["Add missing meta tags for better SEO and social previews"] : [],
    detail: { present: found.map((c) => c.label), missing: missing.map((c) => c.label) },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 9 — Structured Data Parser
   ────────────────────────────────────────────── */
function engineStructuredData(meta) {
  const pages = crawlPages(meta);
  const allHtml = pages.map((p) => p.html || "").join("\n");
  const ldBlocks = [];
  const re = /<script\s+type\s*=\s*["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(allHtml)) !== null) {
    ldBlocks.push(m[1]);
  }

  const schemaCount = {};
  const fancyNames = {
    Organization: "Organization", WebSite: "WebSite", Article: "Article",
    NewsArticle: "News Article", BlogPosting: "Blog Post", Product: "Product",
    LocalBusiness: "Local Business", Person: "Person", Event: "Event",
    FAQPage: "FAQ Page", HowTo: "How-To Guide", BreadcrumbList: "Breadcrumbs",
    SearchAction: "Search Action", VideoObject: "Video", ImageObject: "Image",
    Recipe: "Recipe", Review: "Review", AggregateRating: "Rating",
  };

  ldBlocks.forEach((json) => {
    try {
      const obj = JSON.parse(json);
      const types = [];
      if (Array.isArray(obj["@graph"])) {
        obj["@graph"].forEach((item) => {
          if (item["@type"]) {
            const t = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
            t.forEach((x) => types.push(x));
          }
        });
      } else if (obj["@type"]) {
        const t = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
        types.push(...t);
      }
      types.forEach((t) => {
        schemaCount[t] = (schemaCount[t] || 0) + 1;
      });
    } catch { /* ignore malformed JSON */ }
  });

  const findings = [];
  const schemaTypes = Object.keys(schemaCount);
  schemaTypes.forEach((t) => {
    findings.push({ type: "schema", schema: t, count: schemaCount[t], detail: `${schemaCount[t]}× ${fancyNames[t] || t}` });
  });

  const score = schemaTypes.length >= 3 ? 100 : schemaTypes.length >= 1 ? 70 : 20;
  return {
    score,
    passed: score >= 70,
    findings: findings.length > 0 ? findings : [{ type: "none", detail: "No structured data (JSON-LD) blocks found" }],
    recommendations: schemaTypes.length < 2 ? ["Add structured data (JSON-LD) to improve rich results in search engines"] : [],
    detail: { totalBlocks: ldBlocks.length, schemaTypes, schemaCount },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 10 — DOM Complexity Score
   ────────────────────────────────────────────── */
function engineDOMComplexity(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let maxElements = 0;
  let maxDepth = 0;
  let totalElements = 0;
  let pagesOver1000 = 0;
  let pagesOver20Depth = 0;

  pages.forEach((p) => {
    const html = p.html || "";
    const count = countTags(html);
    totalElements += count;
    if (count > maxElements) maxElements = count;
    if (count > 1000) pagesOver1000++;

    let depth = 0;
    let curDepth = 0;
    for (let i = 0; i < html.length; i++) {
      if (html[i] === "<" && html[i + 1] !== "/" && html[i + 1] !== "!") {
        const tagEnd = html.indexOf(">", i);
        const tag = html.slice(i, tagEnd);
        if (!/\/>$/.test(tag) && !/^(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)\b/i.test(tag.slice(1))) {
          curDepth++;
          if (curDepth > maxDepth) maxDepth = curDepth;
        }
      } else if (html[i] === "<" && html[i + 1] === "/") {
        curDepth = Math.max(0, curDepth - 1);
      }
    }
    if (maxDepth > 20) pagesOver20Depth++;
  });

  const avg = pages.length > 0 ? Math.round(totalElements / pages.length) : 0;

  if (maxElements > 1000) findings.push({ type: "heavy", count: maxElements, detail: `Heaviest page has ${maxElements} elements — consider splitting or lazy loading` });
  if (maxDepth > 20) findings.push({ type: "deep", depth: maxDepth, detail: `DOM depth reaches ${maxDepth} levels — overly nested markup` });

  let score = 100;
  if (pagesOver1000 > 0) score -= 30;
  if (pagesOver20Depth > 0) score -= 20;
  if (avg > 800) score -= 20;
  if (avg > 500) score -= 10;
  score = Math.max(0, score);

  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: maxElements > 1000 ? ["Reduce DOM size — aim for under 1000 elements per page"] : [],
    detail: { maxElements, maxDepth, avgElements: avg, pagesOver1000, pagesOver20Depth, totalPages: pages.length },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 11 — Third-Party Risk Score
   ────────────────────────────────────────────── */
function engineThirdPartyRisk(meta) {
  const svcs = services(meta);
  const findings = [];
  const riskMap = {
    analytics: { score: 25, label: "Analytics", color: "low" },
    cdn: { score: 10, label: "CDN", color: "very-low" },
    ads: { score: 70, label: "Ads", color: "high" },
    advertising: { score: 70, label: "Ads", color: "high" },
    chat: { score: 40, label: "Chat", color: "medium" },
    messaging: { score: 40, label: "Chat", color: "medium" },
    auth: { score: 20, label: "Auth", color: "low" },
    fonts: { score: 10, label: "Fonts", color: "very-low" },
    monitoring: { score: 25, label: "Monitoring", color: "low" },
    captcha: { score: 25, label: "Captcha", color: "low" },
    payments: { score: 45, label: "Payments", color: "medium" },
    widgets: { score: 35, label: "Widgets", color: "medium" },
    tracking: { score: 50, label: "Tracking", color: "medium-high" },
  };

  let totalRisk = 0;
  svcs.forEach((s) => {
    const name = (s.name || "").toLowerCase();
    const category = (s.category || "").toLowerCase();
    let matched = riskMap[name] || riskMap[category];
    if (!matched) {
      if (/analytics|gtag|ga4|segment|mixpanel/.test(name)) matched = riskMap.analytics;
      else if (/cdn|cloudflare|cloudfront|fastly|akamai/.test(name)) matched = riskMap.cdn;
      else if (/ads|advertising|doubleclick|adroll/.test(name)) matched = riskMap.ads;
      else if (/chat|intercom|drift|zendesk|tawk/.test(name)) matched = riskMap.chat;
      else matched = { score: 30, label: "Other", color: "low" };
    }
    totalRisk += matched.score;
    findings.push({ service: s.name || s, risk: matched.score, label: matched.label, detail: `${s.name || s} — ${matched.label} risk (score: ${matched.score})` });
  });

  let overall = "low";
  if (totalRisk > 150) overall = "high";
  else if (totalRisk > 70) overall = "medium";
  else if (svcs.length > 5) overall = "medium";

  const score = svcs.length === 0 ? 100 : totalRisk > 200 ? 30 : totalRisk > 100 ? 50 : totalRisk > 50 ? 70 : 90;
  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: totalRisk > 100 ? ["Reduce third-party dependencies", "Consider self-hosting for analytics/CDN"] : [],
    detail: { totalServices: svcs.length, totalRisk, overallRisk: overall },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 12 — Subresource Integrity Check
   ────────────────────────────────────────────── */
function engineSRI(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let totalExternalScripts = 0;
  let withIntegrity = 0;
  let withoutIntegrity = 0;
  let totalExternalLinks = 0;
  let linksWithIntegrity = 0;
  let linksWithoutIntegrity = 0;
  const withoutExamples = [];

  pages.forEach((p) => {
    const html = p.html || "";
    const baseUrl = p.url || meta?.targetUrl || "";

    const scriptTags = html.match(/<script\b[^>]*>/gi) || [];
    scriptTags.forEach((tag) => {
      const src = extractAttr(tag, "src");
      if (!src) return;
      try {
        const domain = new URL(src, baseUrl).hostname;
        const baseDomain = baseUrl ? parseDomain(baseUrl) : "";
        if (domain && domain !== baseDomain && !src.startsWith("/") && !src.startsWith(".")) {
          totalExternalScripts++;
          if (/\bintegrity\s*=/i.test(tag)) withIntegrity++;
          else {
            withoutIntegrity++;
            if (withoutExamples.length < 3) withoutExamples.push(src);
          }
        }
      } catch { }
    });

    const linkTags = html.match(/<link\b[^>]*>/gi) || [];
    linkTags.forEach((tag) => {
      const href = extractAttr(tag, "href");
      const rel = extractAttr(tag, "rel") || "";
      if (!href || !/(stylesheet|preload|modulepreload)/i.test(rel)) return;
      try {
        const domain = new URL(href, baseUrl).hostname;
        const baseDomain = baseUrl ? parseDomain(baseUrl) : "";
        if (domain && domain !== baseDomain && !href.startsWith("/") && !href.startsWith(".")) {
          totalExternalLinks++;
          if (/\bintegrity\s*=/i.test(tag)) linksWithIntegrity++;
          else {
            linksWithoutIntegrity++;
            if (withoutExamples.length < 5) withoutExamples.push(href);
          }
        }
      } catch { }
    });
  });

  const totalMissing = withoutIntegrity + linksWithoutIntegrity;
  const totalExternal = totalExternalScripts + totalExternalLinks;

  if (totalMissing > 0)
    findings.push({ type: "missing-sri", count: totalMissing, detail: `${totalMissing} external ${totalExternalScripts > 0 ? "scripts" : "resources"} lack integrity attribute` });

  const score = totalExternal === 0 ? 100 : totalMissing === 0 ? 100 : totalMissing > 5 ? 30 : totalMissing > 2 ? 55 : 70;
  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: totalMissing > 0 ? ["Add integrity=\"sha384-...\" to external <script> and <link> tags for security"] : [],
    detail: { totalExternalScripts, withIntegrity, withoutIntegrity, totalExternalLinks, linksWithIntegrity, linksWithoutIntegrity, withoutExamples },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 13 — Web Vitals Estimate
   ────────────────────────────────────────────── */
function engineWebVitals(meta) {
  const pages = crawlPages(meta);
  const findings = [];

  let totalScripts = 0;
  let totalStylesheets = 0;
  let largestImage = 0;
  let largestVideo = 0;

  pages.forEach((p) => {
    const html = p.html || "";
    totalScripts += (html.match(/<script\b/gi) || []).length;
    totalStylesheets += (html.match(/<link\b[^>]*stylesheet/gi) || []).length;

    const imgs = html.match(/<img\b[^>]*>/gi) || [];
    imgs.forEach((img) => {
      const w = extractAttr(img, "width");
      const h = extractAttr(img, "height");
      if (w && h) {
        const area = parseInt(w) * parseInt(h);
        if (area > largestImage) largestImage = area;
      }
    });
    const vids = html.match(/<video\b[^>]*>/gi) || [];
    vids.forEach((vid) => {
      const w = extractAttr(vid, "width");
      const h = extractAttr(vid, "height");
      if (w && h) {
        const area = parseInt(w) * parseInt(h);
        if (area > largestVideo) largestVideo = area;
      }
    });
  });

  const renderBlocking = totalScripts + totalStylesheets;
  let fcpEst = renderBlocking > 30 ? "2.5+ s" : renderBlocking > 15 ? "1.5–2.5 s" : renderBlocking > 5 ? "0.8–1.5 s" : "< 0.8 s";
  let lcpEst = largestImage > 500000 ? "3.0+ s" : largestImage > 100000 ? "2.0–3.0 s" : largestVideo > 500000 ? "3.0+ s" : "< 2.0 s";
  let tbtEst = totalScripts > 30 ? "600+ ms" : totalScripts > 15 ? "200–600 ms" : totalScripts > 5 ? "50–200 ms" : "< 50 ms";

  const fcpColor = renderBlocking > 15 ? "var(--red)" : renderBlocking > 5 ? "var(--amber)" : "var(--green)";
  const lcpColor = largestImage > 100000 ? "var(--red)" : largestImage > 50000 ? "var(--amber)" : "var(--green)";
  const tbtColor = totalScripts > 15 ? "var(--red)" : totalScripts > 5 ? "var(--amber)" : "var(--green)";

  const fcpScore = renderBlocking > 15 ? 30 : renderBlocking > 5 ? 65 : 95;
  const lcpScore = largestImage > 100000 ? 30 : largestImage > 50000 ? 60 : 95;
  const tbtScore = totalScripts > 15 ? 30 : totalScripts > 5 ? 60 : 95;
  const score = Math.round((fcpScore + lcpScore + tbtScore) / 3);

  findings.push(
    { metric: "FCP", estimate: fcpEst, color: fcpColor, detail: `First Contentful Paint ~ ${fcpEst} (${renderBlocking} render-blocking resources)` },
    { metric: "LCP", estimate: lcpEst, color: lcpColor, detail: `Largest Contentful Paint ~ ${lcpEst} (largest image: ${largestImage.toLocaleString()}px area)` },
    { metric: "TBT", estimate: tbtEst, color: tbtColor, detail: `Total Blocking Time ~ ${tbtEst} (${totalScripts} script tags)` },
  );

  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: renderBlocking > 15 ? ["Defer non-critical scripts and stylesheets to improve FCP"] : [],
    detail: { fcpEst, lcpEst, tbtEst, renderBlocking, totalScripts, largestImage, largestVideo, fcpColor, lcpColor, tbtColor },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 14 — Accessibility Quick Audit
   ────────────────────────────────────────────── */
function engineAccessibility(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let totalImgs = 0;
  let missingAlt = 0;
  let totalInputs = 0;
  let inputsWithoutLabel = 0;
  let emptyButtons = 0;
  let totalButtons = 0;
  let hasRole = 0;
  let colorWarnings = 0;

  const badColorCombos = [
    ["#ffffff"],
    ["#fff"],
    ["#808080"],
    ["#999999"],
    ["#cccccc"],
  ];

  pages.forEach((p) => {
    const html = p.html || "";
    const imgTags = html.match(/<img\b[^>]*>/gi) || [];
    imgTags.forEach((tag) => {
      totalImgs++;
      const alt = extractAttr(tag, "alt");
      if (alt === null || alt === "") missingAlt++;
    });

    const inputTags = html.match(/<input\b[^>]*>/gi) || [];
    totalInputs += inputTags.length;
    inputTags.forEach((tag) => {
      const type = extractAttr(tag, "type") || "text";
      if (/(submit|button|hidden|image|reset)/i.test(type)) return;
      const id = extractAttr(tag, "id");
      if (id) {
        const labelRe = new RegExp(`<label\\b[^>]*for\\s*=\\s*["']${id}["']`, "i");
        if (!labelRe.test(html)) inputsWithoutLabel++;
      } else {
        const aria = extractAttr(tag, "aria-label") || extractAttr(tag, "aria-labelledby");
        if (!aria) inputsWithoutLabel++;
      }
    });

    const btnTags = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi) || [];
    totalButtons += btnTags.length;
    btnTags.forEach((tag) => {
      const inner = tag.replace(/<[^>]+>/g, "").trim();
      if (!inner) emptyButtons++;
    });

    const roleTags = html.match(/\brole\s*=\s*["']/gi) || [];
    hasRole += roleTags.length;

    badColorCombos.forEach((colors) => {
      colors.forEach((c) => {
        const re = new RegExp(`color\\s*:\\s*${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`, "gi");
        if (re.test(html)) colorWarnings++;
      });
    });
  });

  if (missingAlt > 0) findings.push({ type: "alt-text", count: missingAlt, total: totalImgs, detail: `${missingAlt}/${totalImgs} images missing alt text` });
  if (inputsWithoutLabel > 0) findings.push({ type: "input-labels", count: inputsWithoutLabel, total: totalInputs, detail: `${inputsWithoutLabel}/${totalInputs} inputs may lack associated labels` });
  if (emptyButtons > 0) findings.push({ type: "empty-buttons", count: emptyButtons, detail: `${emptyButtons} empty <button> elements — no accessible name` });
  if (colorWarnings > 0) findings.push({ type: "color-contrast", count: colorWarnings, detail: `${colorWarnings} potential low-contrast color combinations detected` });
  if (hasRole > 0) findings.push({ type: "roles", count: hasRole, detail: `${hasRole} ARIA role attributes used (good)` });

  let score = 100;
  if (missingAlt > 0) score -= Math.min(30, missingAlt * 5);
  if (inputsWithoutLabel > 0) score -= Math.min(25, inputsWithoutLabel * 5);
  if (emptyButtons > 0) score -= Math.min(20, emptyButtons * 5);
  if (colorWarnings > 3) score -= Math.min(15, colorWarnings * 3);
  score = Math.max(0, score + Math.min(10, hasRole));

  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: missingAlt > 0 ? ["Add descriptive alt text to all meaningful images"] : [],
    detail: { totalImgs, missingAlt, totalInputs, inputsWithoutLabel, totalButtons, emptyButtons, hasRole, colorWarnings },
  };
}

/* ──────────────────────────────────────────────
   ENGINE 15 — Link Health Score
   ────────────────────────────────────────────── */
function engineLinkHealth(meta) {
  const pages = crawlPages(meta);
  const findings = [];
  let internalLinks = 0;
  let externalLinks = 0;
  let blankNoRel = 0;
  let nofollowLinks = 0;
  let mailtoLinks = 0;
  let telLinks = 0;

  pages.forEach((p) => {
    const html = p.html || "";
    const baseUrl = p.url || meta?.targetUrl || "";
    const baseDomain = parseDomain(baseUrl);

    const linkTags = html.match(/<a\b[^>]*>/gi) || [];
    linkTags.forEach((tag) => {
      const href = extractAttr(tag, "href");
      if (!href) return;
      if (/^mailto:/i.test(href)) { mailtoLinks++; return; }
      if (/^tel:/i.test(href)) { telLinks++; return; }

      const target = extractAttr(tag, "target");
      const rel = (extractAttr(tag, "rel") || "").toLowerCase();

      try {
        const domain = new URL(href, baseUrl).hostname;
        if (domain === baseDomain || href.startsWith("/") || href.startsWith(".") || href.startsWith("#")) {
          internalLinks++;
        } else {
          externalLinks++;
          if (target === "_blank" && !/noopener/i.test(rel)) {
            blankNoRel++;
          }
        }
      } catch {
        if (!/^https?:/.test(href)) internalLinks++;
      }

      if (/nofollow/i.test(rel)) nofollowLinks++;
    });
  });

  if (blankNoRel > 0) findings.push({ type: "blank-noopener", count: blankNoRel, detail: `${blankNoRel} external links with target="_blank" missing rel="noopener"` });
  findings.push({ type: "counts", detail: `${internalLinks} internal, ${externalLinks} external links` });

  let score = 100;
  if (blankNoRel > 5) score -= 30;
  else if (blankNoRel > 0) score -= 15;
  if (internalLinks === 0 && externalLinks === 0) score = 50;

  return {
    score,
    passed: score >= 70,
    findings,
    recommendations: blankNoRel > 0 ? ["Add rel=\"noopener noreferrer\" to all target=\"_blank\" links for security"] : [],
    detail: { internalLinks, externalLinks, blankNoRel, nofollowLinks, mailtoLinks, telLinks },
  };
}

/* ──────────────────────────────────────────────
   ICONS for each engine
   ────────────────────────────────────────────── */
const ENGINE_ICONS = [
  "\uD83D\uDCE6", // 1: JS Bundle
  "\uD83C\uDFA8", // 2: CSS
  "\uD83D\uDEE1\uFE0F", // 3: CSP
  "\uD83D\uDCE7", // 4: Email
  "\uD83D\uDD10", // 5: Security.txt
  "\uD83D\uDC74", // 6: Broken Resources
  "\uD83C\uDFD7\uFE0F", // 7: Semantic HTML
  "\uD83C\uDFF7\uFE0F", // 8: Meta Tags
  "\uD83D\uDCCA", // 9: Structured Data
  "\uD83C\uDF09", // 10: DOM Complexity
  "\u26A0\uFE0F", // 11: Third-Party Risk
  "\uD83D\uDD12", // 12: SRI
  "\u26A1", // 13: Web Vitals
  "\u267F", // 14: Accessibility
  "\uD83D\uDD17", // 15: Link Health
];

const ENGINE_TITLES = [
  "JS Bundle Analyzer",
  "CSS Selector Complexity",
  "Auto-Generated CSP Policy",
  "Email Security Config",
  "Security.txt Generator",
  "Broken Resource Detector",
  "Semantic HTML Auditor",
  "Meta Tag Completeness",
  "Structured Data Parser",
  "DOM Complexity Score",
  "Third-Party Risk Score",
  "Subresource Integrity Check",
  "Web Vitals Estimate",
  "Accessibility Quick Audit",
  "Link Health Score",
];

/* ──────────────────────────────────────────────
   RENDER HELPERS
   ────────────────────────────────────────────── */
function Badge({ label, color }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: 1,
      padding: "1px 7px",
      border: `1px solid ${color}`,
      color,
      marginLeft: 8,
    }}>
      {label}
    </span>
  );
}

function TrafficLight({ color }) {
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: color,
      marginRight: 8,
      flexShrink: 0,
    }} />
  );
}

function DetailBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--dim)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12 }}>{children}</div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ color: "var(--dim)" }}>{label}</span>
      <span style={{ color: color || "var(--text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */
export default function DeepScan({ scan }) {
  const [expanded, setExpanded] = useState({});

  const engines = useMemo(() => {
    if (!scan) return [];
    const meta = scan.meta || {};
    const findingsArr = scan.findings || [];

    return [
      engineJSBundles(meta),
      engineCSSComplexity(meta),
      engineCSP(meta),
      engineEmailSecurity(meta),
      engineSecurityTxt(meta, findingsArr),
      engineBrokenResources(meta),
      engineSemanticHTML(meta),
      engineMetaTags(meta),
      engineStructuredData(meta),
      engineDOMComplexity(meta),
      engineThirdPartyRisk(meta),
      engineSRI(meta),
      engineWebVitals(meta),
      engineAccessibility(meta),
      engineLinkHealth(meta),
    ];
  }, [scan]);

  const toggle = (i) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  if (!scan) {
    return (
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>DEEP SCAN — no scan data</span>
        </div>
        <div className="console-body small dim">No scan data available to analyze.</div>
      </div>
    );
  }

  const passedCount = engines.filter((e) => e.passed).length;
  const warnCount = engines.filter((e) => !e.passed && e.score >= 30).length;
  const critCount = engines.filter((e) => e.score < 30).length;

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>DEEP SCAN — 15 CLIENT-SIDE ENGINES</span>
      </div>
      <div className="console-body">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--dim)", letterSpacing: 1, marginBottom: 4 }}>
            Pure JavaScript analysis · No APIs · No servers
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            <span style={{ color: "var(--green)" }}>{passedCount}/15 passed</span>
            <span style={{ color: "var(--amber)" }}>{warnCount} warnings</span>
            <span style={{ color: "var(--red)" }}>{critCount} critical</span>
          </div>
          <div style={{ marginTop: 4, color: "var(--dim)", fontSize: 11 }}>
            Target: {scan.targetUrl || "—"}
          </div>
        </div>

        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {engines.map((engine, i) => {
            const { color: badgeColor, label: badgeLabel } = scoreBadge(engine.score);
            const isOpen = expanded[i] === true;
            return (
              <div key={i} style={{
                marginBottom: 4,
                border: `1px solid ${isOpen ? "var(--line)" : "transparent"}`,
                background: isOpen ? "rgba(255,255,255,0.015)" : "transparent",
              }}>
                {/* Collapsed header */}
                <div
                  onClick={() => toggle(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 12px",
                    cursor: "pointer",
                    userSelect: "none",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 10, color: "var(--dim)", minWidth: 20, textAlign: "center" }}>
                    {isOpen ? "\u25BC" : "\u25B6"}
                  </span>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{ENGINE_ICONS[i]}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>
                    {ENGINE_TITLES[i]}
                  </span>
                  <Badge label={badgeLabel} color={badgeColor} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor(engine.score), minWidth: 36, textAlign: "right" }}>
                    {engine.score}
                  </span>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div style={{ padding: "8px 12px 14px 54px", borderTop: "1px dashed var(--line)" }}>
                    {/* Score bar */}
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${engine.score}%`, background: scoreColor(engine.score), borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>

                    {/* Stats grid */}
                    {engine.detail && typeof engine.detail === "object" && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "2px 16px",
                        }}>
                          {Object.entries(engine.detail)
                            .filter(([k]) => !["brokenExamples", "withoutExamples", "schemaTypes", "schemaCount", "libVersions", "present", "missing", "cspString", "securityTxt", "contact", "expires", "overallRisk", "fcpColor", "lcpColor", "tbtColor"].includes(k))
                            .map(([k, v]) => (
                              <StatRow key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())} value={typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—")} />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Lib versions */}
                    {engine.detail?.libVersions?.length > 0 && (
                      <DetailBlock label="Detected Libraries">
                        {engine.detail.libVersions.map((lib, li) => (
                          <span key={li} style={{ display: "inline-block", padding: "2px 8px", margin: "2px 4px 2px 0", background: "rgba(56,225,255,0.08)", border: "1px solid rgba(56,225,255,0.2)", borderRadius: 3, fontSize: 11, color: "var(--cyan)" }}>
                            {lib}
                          </span>
                        ))}
                      </DetailBlock>
                    )}

                    {/* CSP string */}
                    {engine.detail?.cspString && (
                      <DetailBlock label="Recommended Content-Security-Policy">
                        <pre style={{
                          fontSize: 11,
                          color: "var(--cyan)",
                          background: "rgba(0,0,0,0.25)",
                          padding: "10px",
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          maxHeight: 120,
                          overflowY: "auto",
                        }}>
                          {engine.detail.cspString}
                        </pre>
                      </DetailBlock>
                    )}

                    {/* Security.txt */}
                    {engine.detail?.securityTxt && (
                      <DetailBlock label="Generated security.txt">
                        <pre style={{
                          fontSize: 11,
                          color: "var(--green)",
                          background: "rgba(0,0,0,0.25)",
                          padding: "10px",
                          overflowX: "auto",
                          whiteSpace: "pre-wrap",
                          maxHeight: 160,
                          overflowY: "auto",
                        }}>
                          {engine.detail.securityTxt}
                        </pre>
                      </DetailBlock>
                    )}

                    {/* Broken examples */}
                    {engine.detail?.brokenExamples?.length > 0 && (
                      <DetailBlock label="Broken Resource Examples">
                        {engine.detail.brokenExamples.map((ex, ei) => (
                          <div key={ei} style={{ fontSize: 11, color: "var(--red)", padding: "2px 0", wordBreak: "break-all" }}>
                            [{ex.status}] {ex.url}
                          </div>
                        ))}
                      </DetailBlock>
                    )}

                    {/* SRI without examples */}
                    {engine.detail?.withoutExamples?.length > 0 && (
                      <DetailBlock label="External Resources Without SRI">
                        {engine.detail.withoutExamples.map((ex, ei) => (
                          <div key={ei} style={{ fontSize: 11, color: "var(--amber)", padding: "2px 0", wordBreak: "break-all" }}>
                            {ex}
                          </div>
                        ))}
                      </DetailBlock>
                    )}

                    {/* Web Vitals traffic lights */}
                    {engine.findings?.some((f) => f.metric) && (
                      <DetailBlock label="Estimated Metrics">
                        {engine.findings.filter((f) => f.metric).map((f, fi) => (
                          <div key={fi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12 }}>
                            <TrafficLight color={f.color} />
                            <span style={{ fontWeight: 600, minWidth: 40 }}>{f.metric}</span>
                            <span style={{ color: f.color }}>{f.estimate}</span>
                            <span style={{ color: "var(--dim)", fontSize: 10, marginLeft: "auto" }}>{f.detail}</span>
                          </div>
                        ))}
                      </DetailBlock>
                    )}

                    {/* Findings list */}
                    {engine.findings?.filter((f) => !f.metric).length > 0 && (
                      <DetailBlock label="Findings">
                        {engine.findings.filter((f) => !f.metric).map((f, fi) => (
                          <div key={fi} style={{ fontSize: 11.5, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.02)", color: f.type === "none" ? "var(--dim)" : f.type === "missing-sri" || f.type === "missing-spf" || f.type === "missing-dkim" || f.type === "missing-dmarc" ? "var(--red)" : "var(--text)" }}>
                            {f.detail || f.type}
                          </div>
                        ))}
                      </DetailBlock>
                    )}

                    {/* Structured Data schema types */}
                    {engine.detail?.schemaTypes?.length > 0 && (
                      <DetailBlock label="Schema Types Detected">
                        {engine.detail.schemaTypes.map((t, si) => (
                          <span key={si} style={{ display: "inline-block", padding: "2px 8px", margin: "2px 4px 2px 0", background: "rgba(255,176,32,0.08)", border: "1px solid rgba(255,176,32,0.2)", borderRadius: 3, fontSize: 11, color: "var(--amber)" }}>
                            {t} ({engine.detail.schemaCount[t]})
                          </span>
                        ))}
                      </DetailBlock>
                    )}

                    {/* Recommendations */}
                    {engine.recommendations?.length > 0 && (
                      <DetailBlock label={`Recommendations (${engine.recommendations.length})`}>
                        {engine.recommendations.map((rec, ri) => (
                          <div key={ri} style={{ fontSize: 11.5, color: "var(--cyan)", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                            {typeof rec === "string" ? "\u2192 " + rec : rec}
                          </div>
                        ))}
                      </DetailBlock>
                    )}

                    {/* Email specific detail */}
                    {engine.detail?.spf !== undefined && (
                      <DetailBlock label="Email Security Status">
                        <StatRow label="SPF" value={engine.detail.spf ? "Present" : "Missing"} color={engine.detail.spf ? "var(--green)" : "var(--red)"} />
                        <StatRow label="DKIM" value={engine.detail.dkim ? "Present" : "Missing"} color={engine.detail.dkim ? "var(--green)" : "var(--red)"} />
                        <StatRow label="DMARC" value={engine.detail.dmarc ? "Present" : "Missing"} color={engine.detail.dmarc ? "var(--green)" : "var(--red)"} />
                      </DetailBlock>
                    )}

                    {/* Meta tag presence */}
                    {engine.detail?.present && (
                      <DetailBlock label="Meta Tags Present">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 6px" }}>
                          {engine.detail.present.map((t, ti) => (
                            <span key={ti} style={{ fontSize: 10, color: "var(--green)", padding: "1px 6px", border: "1px solid rgba(51,255,161,0.3)" }}>
                              {t}
                            </span>
                          ))}
                          {engine.detail.missing?.map((t, ti) => (
                            <span key={"m" + ti} style={{ fontSize: 10, color: "var(--red)", padding: "1px 6px", border: "1px solid rgba(255,77,94,0.3)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </DetailBlock>
                    )}

                    {/* Third-party risk overall */}
                    {engine.detail?.overallRisk && (
                      <DetailBlock label="Overall Risk">
                        <span style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: engine.detail.overallRisk === "high" ? "var(--red)" : engine.detail.overallRisk === "medium" ? "var(--amber)" : "var(--green)",
                          textTransform: "uppercase",
                        }}>
                          {engine.detail.overallRisk} ({engine.detail.totalRisk} risk score)
                        </span>
                      </DetailBlock>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom summary */}
        <div style={{
          marginTop: 16,
          padding: "12px 14px",
          border: `1px solid ${critCount > 0 ? "var(--red)" : warnCount > 0 ? "var(--amber)" : "var(--green)"}`,
          background: critCount > 0 ? "rgba(255,77,94,0.06)" : warnCount > 0 ? "rgba(255,176,32,0.06)" : "rgba(51,255,161,0.06)",
          fontSize: 13,
          fontWeight: 700,
          color: critCount > 0 ? "var(--red)" : warnCount > 0 ? "var(--amber)" : "var(--green)",
          letterSpacing: 1,
        }}>
          {critCount > 0
            ? `${critCount} CRITICAL — immediate attention required`
            : warnCount > 0
              ? `${warnCount} warnings — review recommended`
              : "All 15 engines passed — excellent baseline"}
        </div>
      </div>
    </div>
  );
}
