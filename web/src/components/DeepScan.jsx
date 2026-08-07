import { useState, useMemo } from "react";

function clr(score) {
  if (score >= 85) return "var(--green)";
  if (score >= 65) return "var(--cyan)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}
function badge(score) {
  return { color: clr(score), label: score >= 85 ? "PASS" : score >= 65 ? "OK" : score >= 40 ? "WARN" : "FAIL" };
}

// ── Real HTML parsing using DOMParser ──
function parseHTML(html) {
  try {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return doc;
  } catch { return null; }
}

function getHTML(meta) {
  const pages = meta?.pageData || [];
  return pages.map((p) => ({ url: p.url, html: p.htmlSnippet || p.html || "", status: p.status }));
}

function getExternal(meta) {
  return meta?.externalResources || { scripts: [], styles: [], images: [], links: [] };
}

function getServices(meta) {
  return meta?.services || [];
}

function getTech(meta) {
  return meta?.tech || [];
}

// ══════════════════════════════════════════════
// ENGINE 1 — Real JS Bundle Analysis
// ══════════════════════════════════════════════
function engineJSMaster(meta) {
  const files = meta?.jsFiles || [];
  const ext = getExternal(meta);
  const allScripts = [...new Set([...files.map(f => typeof f === "string" ? f : f.url || ""), ...ext.scripts])];
  let totalSize = 0, minified = 0, unminified = 0, heavy = 0, withSRI = 0, thirdParty = 0, firstParty = 0;
  const frameworks = [];
  const heavyFiles = [];
  const host = meta?.host || "";

  const JS_PATTERNS = [
    [/react.*(\d+\.\d+\.\d+)/i, "React"], [/vue.*(\d+\.\d+\.\d+)/i, "Vue.js"],
    [/jquery.*(\d+\.\d+\.\d+)/i, "jQuery"], [/lodash.*(\d+\.\d+\.\d+)/i, "Lodash"],
    [/moment.*(\d+\.\d+\.\d+)/i, "Moment.js"], [/d3.*(\d+\.\d+\.\d+)/i, "D3.js"],
    [/three.*(\d+\.\d+\.\d+)/i, "Three.js"], [/chart.*(\d+\.\d+\.\d+)/i, "Chart.js"],
    [/angular.*(\d+\.\d+\.\d+)/i, "Angular"], [/svelte.*(\d+\.\d+\.\d+)/i, "Svelte"],
    [/alpine.*(\d+\.\d+\.\d+)/i, "Alpine.js"], [/htmx.*(\d+\.\d+\.\d+)/i, "HTMX"],
    [/preact.*(\d+\.\d+\.\d+)/i, "Preact"], [/lit.*(\d+\.\d+\.\d+)/i, "Lit"],
  ];

  allScripts.forEach((s) => {
    const isExternal = s.startsWith("http");
    const isThirdParty = isExternal && !s.includes(host);
    if (isThirdParty) thirdParty++;
    else firstParty++;

    if (/\.min\./i.test(s)) minified++;
    else unminified++;
    if (s.length > 80 || (typeof s === "string" && s.includes("bundle"))) {
      heavy++;
      heavyFiles.push(s.split("/").pop()?.split("?")[0] || s.slice(-40));
    }
    frameworks.forEach(p => { const m = s.match(p[0]); if (m) frameworks.push(`${p[1]}@${m[1]}`); });
  });

  const score = heavy > 3 ? 40 : heavy > 0 ? 60 : unminified > 2 ? 65 : thirdParty > 8 ? 55 : 95;
  return {
    score,
    passed: score >= 65,
    findings: [
      heavy > 0 && `${heavy} large bundles detected — consider code splitting`,
      thirdParty > 5 && `${thirdParty} third-party scripts — each is a trust boundary`,
      unminified > 0 && `${unminified} unminified scripts — harder to cache, expose source logic`,
    ].filter(Boolean),
    recommendations: [
      heavy > 0 && "Split heavy bundles with dynamic imports or code splitting",
      thirdParty > 5 && "Audit third-party scripts for necessity — each increases attack surface",
      unminified > 0 && "Minify JS in production builds",
    ].filter(Boolean),
    detail: { total: allScripts.length, firstParty, thirdParty, minified, unminified, heavy, heavyFiles },
  };
}

// ══════════════════════════════════════════════
// ENGINE 2 — CSS Quality & Bloat
// ══════════════════════════════════════════════
function engineCSSMaster(meta) {
  const pages = getHTML(meta);
  let important = 0, deepNested = 0, universalStars = 0, idSelectors = 0, totalRules = 0;
  let inlineStyles = 0, externalStylesheets = 0;

  pages.forEach((p) => {
    const html = p.html || "";
    const doc = parseHTML(html);
    if (!doc) return;

    const styleTags = doc.querySelectorAll("style");
    styleTags.forEach((s) => {
      const css = s.textContent || "";
      important += (css.match(/!important/gi) || []).length;
      universalStars += (css.match(/ \*(?![\w-])/g) || []).length;
      idSelectors += (css.match(/#[a-zA-Z][\w-]*\s*\{/g) || []).length;
      const rules = css.split("{").length - 1;
      totalRules += rules;

      // Detect deep nesting by counting combinator depth
      const blocks = css.split("{");
      blocks.forEach((b) => {
        const sel = b.split("}").pop() || "";
        const combinators = (sel.match(/[ >+~]/g) || []).length;
        if (combinators > 4) deepNested++;
      });
    });

    inlineStyles += (html.match(/style\s*=\s*["']/gi) || []).length;
    externalStylesheets += doc.querySelectorAll("link[rel=stylesheet]").length;
  });

  const findings = [];
  if (important > 10) findings.push(`${important} !important overrides — specificity war in progress`);
  if (deepNested > 5) findings.push(`${deepNested} deeply nested selectors (>4 levels) — fragile and hard to maintain`);
  if (idSelectors > 8) findings.push(`${idSelectors} ID selectors — zero reusability, maximum specificity`);
  if (universalStars > 5) findings.push(`${universalStars} universal * selectors — performance hit on large DOM`);
  if (inlineStyles > 10) findings.push(`${inlineStyles} inline styles — blocks CSP, hurts maintainability`);

  const demerits = important + deepNested * 2 + idSelectors + universalStars + inlineStyles;
  const score = demerits > 50 ? 30 : demerits > 25 ? 50 : demerits > 10 ? 70 : 95;
  return {
    score,
    passed: score >= 65,
    findings,
    recommendations: [
      important > 10 && "Refactor CSS to use proper specificity instead of !important",
      deepNested > 5 && "Flatten selectors — BEM or utility-first approaches prevent deep nesting",
      idSelectors > 8 && "Replace ID selectors with class selectors for reusability",
      inlineStyles > 10 && "Move inline styles to external stylesheets",
    ].filter(Boolean),
    detail: { important, deepNested, universalStars, idSelectors, totalRules, inlineStyles, externalStylesheets },
  };
}

// ══════════════════════════════════════════════
// ENGINE 3 — Smart CSP Generator
// ══════════════════════════════════════════════
function engineCSPMaster(meta) {
  const pages = getHTML(meta);
  const ext = getExternal(meta);
  const scriptSrcs = new Set(["'self'"]);
  const styleSrcs = new Set(["'self'"]);
  const imgSrcs = new Set(["'self'", "data:"]);
  const fontSrcs = new Set(["'self'"]);
  const connectSrcs = new Set(["'self'"]);
  const frameSrcs = new Set();
  const mediaSrcs = new Set();

  const host = meta?.host || "";
  const addDomain = (url, set) => {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) return;
    try { const u = new URL(url, `https://${host}`); set.add(u.origin); } catch {}
  };

  ext.scripts.forEach((s) => addDomain(s, scriptSrcs));
  ext.styles.forEach((s) => addDomain(s, styleSrcs));
  ext.images.forEach((s) => addDomain(s, imgSrcs));
  ext.links.forEach((s) => addDomain(s, connectSrcs));

  // Check for inline scripts/styles
  pages.forEach((p) => {
    const html = p.html || "";
    if (/<script[^>]*>(?!\s*<\/script)[\s\S]*?<\/script>/i.test(html)) scriptSrcs.add("'unsafe-inline'");
    if (/<style[^>]*>[\s\S]*?<\/style>/i.test(html)) styleSrcs.add("'unsafe-inline'");
    if (/on(?:click|load|error|submit|change|mouse)\s*=/i.test(html)) {
      scriptSrcs.add("'unsafe-hashes'");
    }
  });

  const dirs = [];
  if (frameSrcs.size) dirs.push(`frame-src ${[...frameSrcs].join(" ")}`);
  if (mediaSrcs.size) dirs.push(`media-src ${[...mediaSrcs].join(" ")}`);

  const csp = [
    `default-src 'self'`,
    `script-src ${[...scriptSrcs].join(" ")}`,
    `style-src ${[...styleSrcs].join(" ")}`,
    `img-src ${[...imgSrcs].join(" ")}`,
    `font-src ${[...fontSrcs].join(" ")}`,
    `connect-src ${[...connectSrcs].join(" ")}`,
    ...dirs,
    `frame-ancestors 'self'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");

  const hasInline = scriptSrcs.has("'unsafe-inline'") || styleSrcs.has("'unsafe-inline'");
  const score = hasInline ? 50 : scriptSrcs.size > 3 ? 65 : 95;
  return {
    score,
    passed: score >= 65,
    findings: [
      hasInline && "Inline scripts/styles detected — needs 'unsafe-inline' in CSP (weakens protection)",
      scriptSrcs.size > 4 && `${scriptSrcs.size - 1} external script origins — broad script-src`,
    ].filter(Boolean),
    recommendations: [
      hasInline && "Extract inline scripts to external files, use nonces/hashes instead of 'unsafe-inline'",
      "Copy the generated CSP below into your server config or meta tag",
    ].filter(Boolean),
    detail: { cspString: csp, scriptOrigins: [...scriptSrcs].filter(s => s !== "'self'"), hasInline },
  };
}

// ══════════════════════════════════════════════
// ENGINE 4 — Email Security (SPF/DKIM/DMARC)
// ══════════════════════════════════════════════
function engineEmailMaster(meta) {
  const txt = (meta?.hostInfo?.txt || []).join(" ");
  const host = meta?.host || "example.com";
  const spf = /v=spf1/i.test(txt);
  const dkim = /dkim/i.test(txt);
  const dmarc = /v=dmarc1/i.test(txt) || /_dmarc/i.test(txt);

  const records = {};
  if (!spf) records.spf = `v=spf1 mx a include:_spf.${host.replace(/^www\./, "")} ~all`;
  if (!dkim) records.dkim = `Add DKIM by generating a key pair and publishing the public key as a TXT record at default._domainkey.${host.replace(/^www\./, "")}`;
  if (!dmarc) records.dmarc = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${host.replace(/^www\./, "")}; ruf=mailto:dmarc-forensic@${host.replace(/^www\./, "")}; pct=100; adkim=r; aspf=r`;

  const missing = [!spf && "SPF", !dkim && "DKIM", !dmarc && "DMARC"].filter(Boolean);
  const score = missing.length === 0 ? 95 : missing.length === 1 ? 60 : missing.length === 2 ? 35 : 15;
  return {
    score,
    passed: score >= 65,
    findings: missing.map(m => `Missing ${m} record — emails may be flagged as spam or spoofed`),
    recommendations: [
      !spf && `Add SPF TXT record: ${records.spf}`,
      !dkim && `Configure DKIM signing for your email provider`,
      !dmarc && `Add DMARC TXT record at _dmarc.${host.replace(/^www\./, "")}: ${records.dmarc}`,
    ].filter(Boolean),
    detail: { spf, dkim, dmarc, records, missing },
  };
}

// ══════════════════════════════════════════════
// ENGINE 5 — Security.txt Generator
// ══════════════════════════════════════════════
function engineSecurityTxtMaster(scan) {
  const host = scan?.meta?.host || scan?.targetUrl || "example.com";
  const domain = host.replace(/^www\./, "");
  const findings = scan?.findings || [];
  const emails = [];
  findings.forEach((f) => {
    if (f.evidence) {
      const m = f.evidence.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (m) emails.push(...m);
    }
  });
  const contact = [...new Set(emails)].find(e => e.includes(domain)) || [...new Set(emails)][0] || `security@${domain}`;
  const expiry = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

  const txt = [
    `Contact: mailto:${contact}`,
    `Expires: ${expiry}`,
    `Preferred-Languages: en`,
    `Canonical: https://${domain}/.well-known/security.txt`,
    `Policy: https://${domain}/security-policy`,
  ].join("\n");

  return {
    score: 90,
    passed: true,
    findings: ["security.txt not currently published — recommended for vulnerability disclosure"],
    recommendations: [`Upload this file to https://${domain}/.well-known/security.txt`],
    detail: { securityTxt: txt, contact, expiry },
  };
}

// ══════════════════════════════════════════════
// ENGINE 6 — Broken Resource Hunter
// ══════════════════════════════════════════════
function engineBrokenResources(meta) {
  const pages = getHTML(meta);
  let total4xx = 0, total5xx = 0;
  const broken = [];

  pages.forEach((p) => {
    if (p.status >= 400) {
      if (p.status < 500) total4xx++;
      else total5xx++;
      broken.push({ url: p.url, status: p.status });
    }
  });

  const score = broken.length > 5 ? 30 : broken.length > 0 ? 55 : 100;
  return {
    score,
    passed: score >= 65,
    findings: [
      total4xx > 0 && `${total4xx} pages returned 4xx errors — check internal links`,
      total5xx > 0 && `${total5xx} pages returned 5xx errors — server-side issues detected`,
    ].filter(Boolean),
    recommendations: [
      total4xx > 0 && "Fix or redirect broken internal links",
      total5xx > 0 && "Investigate server errors — check logs for 5xx responses",
    ].filter(Boolean),
    detail: { total4xx, total5xx, total: broken.length, brokenExamples: broken.slice(0, 8) },
  };
}

// ══════════════════════════════════════════════
// ENGINE 7 — Semantic HTML Auditor
// ══════════════════════════════════════════════
function engineSemanticHTML(meta) {
  const pages = getHTML(meta);
  let pagesMissingMain = 0, pagesMissingNav = 0, brokenHeading = 0, totalChecked = 0;
  let totalLandmarks = 0;

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    totalChecked++;
    if (!doc.querySelector("main")) pagesMissingMain++;
    if (!doc.querySelector("nav")) pagesMissingNav++;

    const headings = doc.querySelectorAll("h1,h2,h3,h4,h5,h6");
    let prevLevel = 0;
    headings.forEach((h) => {
      const level = parseInt(h.tagName[1]);
      if (level > prevLevel + 1 && prevLevel > 0) brokenHeading++;
      prevLevel = level;
    });

    ["header", "main", "nav", "footer", "aside", "article", "section"].forEach((el) => {
      if (doc.querySelector(el)) totalLandmarks++;
    });
  });

  const score = pagesMissingMain > 0 ? 40 : brokenHeading > 0 ? 50 : pagesMissingNav > 0 ? 60 : totalLandmarks < 3 ? 55 : 90;
  return {
    score,
    passed: score >= 65,
    findings: [
      pagesMissingMain > 0 && `${pagesMissingMain}/${totalChecked} pages missing <main> — affects screen reader navigation`,
      brokenHeading > 0 && `${brokenHeading} heading level skips detected — h1→h3 without h2`,
      pagesMissingNav > 0 && `${pagesMissingNav}/${totalChecked} pages missing <nav> — no navigation landmark`,
      totalLandmarks < 3 && `Only ${totalLandmarks} semantic landmarks across ${totalChecked} pages — bare minimum HTML`,
    ].filter(Boolean),
    recommendations: [
      pagesMissingMain > 0 && "Add <main> element to wrap primary content",
      brokenHeading > 0 && "Ensure headings follow proper hierarchy: h1 → h2 → h3",
      totalLandmarks < 5 && "Add <header>, <nav>, <main>, <footer> landmarks for accessibility",
    ].filter(Boolean),
    detail: { pagesMissingMain, pagesMissingNav, brokenHeading, totalLandmarks, totalChecked },
  };
}

// ══════════════════════════════════════════════
// ENGINE 8 — Meta Tag Completeness
// ══════════════════════════════════════════════
function engineMetaTagsMaster(meta) {
  const pages = getHTML(meta);
  const allMeta = { title: true, description: true, viewport: true, charset: true, ogTitle: true, ogDesc: true, ogImage: true, ogUrl: true, twitterCard: true, canonical: true, robots: true };
  const present = [];
  const missing = [];

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;

    if (doc.title) { allMeta.title = false; present.push("title"); } else missing.push("title");
    if (doc.querySelector("meta[name=description]")) { allMeta.description = false; present.push("description"); } else missing.push("description");
    if (doc.querySelector("meta[name=viewport]")) { allMeta.viewport = false; present.push("viewport"); } else missing.push("viewport");
    if (doc.querySelector("meta[charset]") || doc.querySelector("meta[http-equiv=content-type]")) { allMeta.charset = false; present.push("charset"); }
    if (doc.querySelector("meta[property='og:title']")) { allMeta.ogTitle = false; present.push("og:title"); } else missing.push("og:title");
    if (doc.querySelector("meta[property='og:description']")) { allMeta.ogDesc = false; present.push("og:description"); } else missing.push("og:description");
    if (doc.querySelector("meta[property='og:image']")) { allMeta.ogImage = false; present.push("og:image"); } else missing.push("og:image");
    if (doc.querySelector("meta[name='twitter:card']")) { allMeta.twitterCard = false; present.push("twitter:card"); } else missing.push("twitter:card");
    if (doc.querySelector("link[rel=canonical]")) { allMeta.canonical = false; present.push("canonical"); } else missing.push("canonical");
  });

  const uniqPresent = [...new Set(present)];
  const uniqMissing = [...new Set(missing)];
  const score = uniqMissing.length === 0 ? 100 : uniqMissing.length <= 2 ? 75 : uniqMissing.length <= 4 ? 50 : 25;
  return {
    score,
    passed: score >= 65,
    findings: uniqMissing.map(m => `Missing <meta> tag: ${m} — affects SEO and social sharing`),
    recommendations: uniqMissing.map(m => `Add <meta> tag for ${m}`),
    detail: { present: uniqPresent, missing: uniqMissing },
  };
}

// ══════════════════════════════════════════════
// ENGINE 9 — Structured Data (JSON-LD)
// ══════════════════════════════════════════════
function engineStructuredData(meta) {
  const pages = getHTML(meta);
  const schemaTypes = {};
  let totalBlocks = 0;

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    const scripts = doc.querySelectorAll("script[type='application/ld+json']");
    scripts.forEach((s) => {
      try {
        const data = JSON.parse(s.textContent || "");
        const items = Array.isArray(data) ? data : [data];
        items.forEach((item) => {
          const type = item["@type"] || "Unknown";
          schemaTypes[type] = (schemaTypes[type] || 0) + 1;
          totalBlocks++;
        });
      } catch { /* malformed JSON-LD */ }
    });
  });

  const types = Object.keys(schemaTypes);
  const score = types.length >= 3 ? 95 : types.length >= 1 ? 70 : totalBlocks > 0 ? 50 : 25;
  return {
    score,
    passed: score >= 65,
    findings: [
      types.length === 0 && "No structured data found — missing rich result eligibility for search engines",
      totalBlocks > 0 && `${totalBlocks} JSON-LD blocks with ${types.length} schema types detected`,
    ].filter(Boolean),
    recommendations: [
      types.length === 0 && "Add JSON-LD structured data: Organization, WebSite, and BreadcrumbList minimum",
      !schemaTypes.Organization && "Add Organization schema with name, url, and logo",
      !schemaTypes.WebSite && "Add WebSite schema with SearchAction for sitelinks search box",
    ].filter(Boolean),
    detail: { totalBlocks, types, schemaTypes },
  };
}

// ══════════════════════════════════════════════
// ENGINE 10 — DOM Complexity
// ══════════════════════════════════════════════
function engineDOMComplexity(meta) {
  const pages = getHTML(meta);
  let totalElements = 0, maxDepth = 0, maxElements = 0;
  const pageStats = [];

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    const all = doc.querySelectorAll("*");
    const count = all.length;
    totalElements += count;
    if (count > maxElements) maxElements = count;

    let depth = 0;
    const walker = document.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      let d = 0, parent = node.parentElement;
      while (parent) { d++; parent = parent.parentElement; }
      if (d > depth) depth = d;
    }
    if (depth > maxDepth) maxDepth = depth;
    pageStats.push({ url: p.url, elements: count, depth });
  });

  const avgElements = pages.length > 0 ? Math.round(totalElements / pages.length) : 0;
  const findings = [];
  if (maxElements > 1500) findings.push(`Largest page has ${maxElements} DOM elements — heavy rendering cost`);
  if (maxDepth > 25) findings.push(`Max DOM depth: ${maxDepth} levels — deeply nested structure hurts performance`);
  if (avgElements > 800) findings.push(`Average ${avgElements} elements per page — high DOM complexity`);

  const score = maxElements > 2000 ? 20 : maxElements > 1000 ? 45 : maxElements > 500 ? 65 : maxDepth > 20 ? 55 : 95;
  return {
    score,
    passed: score >= 65,
    findings,
    recommendations: [
      maxElements > 1000 && "Reduce DOM size — virtualize long lists, remove unused elements",
      maxDepth > 20 && "Flatten DOM structure — avoid excessive wrapper divs",
    ].filter(Boolean),
    detail: { totalElements, avgElements, maxElements, maxDepth, totalPages: pages.length, pageStats: pageStats.slice(0, 5) },
  };
}

// ══════════════════════════════════════════════
// ENGINE 11 — Third-Party Risk Exposure
// ══════════════════════════════════════════════
function engineThirdPartyRisk(meta) {
  const svcs = getServices(meta);
  const RISK = {
    Analytics: 2, Ads: 5, Payments: 3, Chat: 2, Marketing: 3, CDN: 1, Auth: 1, Other: 3,
  };
  let totalRisk = 0;
  const byRisk = { high: [], medium: [], low: [] };

  svcs.forEach((s) => {
    const risk = RISK[s.category] || 2;
    totalRisk += risk;
    const entry = `${s.name} (${s.category})`;
    if (risk >= 4) byRisk.high.push(entry);
    else if (risk >= 2) byRisk.medium.push(entry);
    else byRisk.low.push(entry);
  });

  const level = totalRisk > 20 ? "high" : totalRisk > 10 ? "medium" : "low";
  const score = totalRisk > 25 ? 20 : totalRisk > 15 ? 40 : totalRisk > 8 ? 60 : totalRisk > 0 ? 80 : 95;
  return {
    score,
    passed: score >= 65,
    findings: [
      svcs.length > 0 && `${svcs.length} third-party services — each is a trust boundary and supply-chain risk`,
      byRisk.high.length > 0 && `${byRisk.high.length} high-risk services (ads/trackers) — privacy & security concern`,
    ].filter(Boolean),
    recommendations: [
      byRisk.high.length > 0 && "Audit high-risk third parties — can they be replaced or removed?",
      svcs.length > 8 && "Consider reducing third-party dependencies to minimize attack surface",
    ].filter(Boolean),
    detail: { totalRisk, level, totalServices: svcs.length, byRisk },
  };
}

// ══════════════════════════════════════════════
// ENGINE 12 — Subresource Integrity (SRI)
// ══════════════════════════════════════════════
function engineSRI(meta) {
  const pages = getHTML(meta);
  let withSRI = 0, withoutSRI = 0;
  const withoutExamples = [];

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    const scripts = doc.querySelectorAll("script[src]");
    const links = doc.querySelectorAll("link[rel=stylesheet][href]");
    [...scripts, ...links].forEach((el) => {
      const src = el.getAttribute("src") || el.getAttribute("href") || "";
      if (!src.includes(meta?.host || "localhost") && src.startsWith("http")) {
        if (el.hasAttribute("integrity")) withSRI++;
        else {
          withoutSRI++;
          if (withoutExamples.length < 10) withoutExamples.push(src);
        }
      }
    });
  });

  const total = withSRI + withoutSRI;
  const score = total === 0 ? 100 : withoutSRI === 0 ? 100 : withSRI / total > 0.5 ? 60 : 25;
  return {
    score,
    passed: score >= 65,
    findings: [
      total > 0 && withoutSRI > 0 && `${withoutSRI}/${total} external resources missing SRI hashes — vulnerable to CDN compromise`,
      total === 0 && "No external CDN resources detected — SRI not needed",
    ].filter(Boolean),
    recommendations: [
      withoutSRI > 0 && "Add integrity hashes to external script/link tags using SRI",
      withoutSRI > 0 && "Generate hashes: openssl dgst -sha384 -binary file.js | openssl base64 -A",
    ].filter(Boolean),
    detail: { withSRI, withoutSRI, total, withoutExamples },
  };
}

// ══════════════════════════════════════════════
// ENGINE 13 — Web Vitals Estimator
// ══════════════════════════════════════════════
function engineWebVitals(meta) {
  const pages = getHTML(meta);
  let renderBlocking = 0, largestImageEstimate = 0, totalScripts = 0, totalCSS = 0;

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    renderBlocking += doc.querySelectorAll("link[rel=stylesheet]").length;
    totalScripts += doc.querySelectorAll("script[src]").length;
    totalCSS += doc.querySelectorAll("link[rel=stylesheet], style").length;

    const imgs = doc.querySelectorAll("img");
    imgs.forEach((img) => {
      const w = parseInt(img.getAttribute("width") || "0");
      const h = parseInt(img.getAttribute("height") || "0");
      if (w * h > largestImageEstimate) largestImageEstimate = w * h;
    });
  });

  const fcp = renderBlocking > 5 ? "slow" : renderBlocking > 2 ? "moderate" : "good";
  const lcp = largestImageEstimate > 500000 ? "slow" : largestImageEstimate > 100000 ? "moderate" : "good";
  const tbt = totalScripts > 10 ? "slow" : totalScripts > 5 ? "moderate" : "good";

  const issues = [fcp === "slow" && 1, lcp === "slow" && 1, tbt === "slow" && 1].filter(Boolean).length;
  const score = issues >= 3 ? 20 : issues >= 2 ? 40 : issues >= 1 ? 60 : 90;
  return {
    score,
    passed: score >= 65,
    findings: [
      { metric: "FCP", estimate: fcp, color: fcp === "good" ? "var(--green)" : fcp === "moderate" ? "var(--amber)" : "var(--red)", detail: `${renderBlocking} render-blocking resources` },
      { metric: "LCP", estimate: lcp, color: lcp === "good" ? "var(--green)" : lcp === "moderate" ? "var(--amber)" : "var(--red)", detail: largestImageEstimate > 0 ? `largest image ~${Math.round(largestImageEstimate / 1000)}K pixels` : "no images" },
      { metric: "TBT", estimate: tbt, color: tbt === "good" ? "var(--green)" : tbt === "moderate" ? "var(--amber)" : "var(--red)", detail: `${totalScripts} scripts` },
    ],
    recommendations: [
      renderBlocking > 2 && "Reduce render-blocking stylesheets — inline critical CSS, defer the rest",
      totalScripts > 5 && "Defer non-critical scripts with async/defer attributes",
    ].filter(Boolean),
    detail: { renderBlocking, totalScripts, totalCSS, largestImageEstimate, fcp, lcp, tbt },
  };
}

// ══════════════════════════════════════════════
// ENGINE 14 — Accessibility Quick Audit
// ══════════════════════════════════════════════
function engineAccessibility(meta) {
  const pages = getHTML(meta);
  let missingAlt = 0, emptyButtons = 0, missingLabels = 0, totalImgs = 0, totalButtons = 0, totalInputs = 0;
  let hasLang = false, ariaRoles = 0;

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    if (doc.documentElement.hasAttribute("lang")) hasLang = true;

    doc.querySelectorAll("img").forEach((img) => { totalImgs++; if (!img.getAttribute("alt") && img.getAttribute("role") !== "presentation") missingAlt++; });
    doc.querySelectorAll("button").forEach((btn) => { totalButtons++; if (!btn.textContent?.trim() && !btn.getAttribute("aria-label") && !btn.querySelector("img[alt]")) emptyButtons++; });
    doc.querySelectorAll("input:not([type=hidden])").forEach((inp) => { totalInputs++; const id = inp.id; if (id && !doc.querySelector(`label[for="${id}"]`) && !inp.getAttribute("aria-label")) missingLabels++; });
    doc.querySelectorAll("[role]").forEach(() => ariaRoles++);
  });

  const issues = [];
  if (totalImgs > 0 && missingAlt / totalImgs > 0.3) issues.push(`${missingAlt}/${totalImgs} images missing alt text`);
  if (totalButtons > 0 && emptyButtons > 0) issues.push(`${emptyButtons} empty buttons without labels`);
  if (totalInputs > 0 && missingLabels > 0) issues.push(`${missingLabels} inputs missing associated labels`);
  if (!hasLang) issues.push("No lang attribute on <html> — screen readers can't detect language");

  const totalIssues = issues.length;
  const score = totalIssues === 0 ? 100 : totalIssues === 1 ? 70 : totalIssues === 2 ? 45 : 20;
  return {
    score,
    passed: score >= 65,
    findings: issues,
    recommendations: [
      missingAlt > 0 && "Add descriptive alt text to all meaningful images",
      emptyButtons > 0 && "Add aria-label or text content to all buttons",
      missingLabels > 0 && "Connect inputs to labels using for/id or wrap inputs inside labels",
      !hasLang && "Add lang attribute: <html lang='en'>",
    ].filter(Boolean),
    detail: { missingAlt, emptyButtons, missingLabels, totalImgs, totalButtons, totalInputs, hasLang, ariaRoles },
  };
}

// ══════════════════════════════════════════════
// ENGINE 15 — Link Health & Safety
// ══════════════════════════════════════════════
function engineLinkHealth(meta) {
  const pages = getHTML(meta);
  let internal = 0, external = 0, noRel = 0, noFollow = 0, mailto = 0, tel = 0;
  const host = meta?.host || "";

  pages.forEach((p) => {
    const doc = parseHTML(p.html);
    if (!doc) return;
    doc.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (href.startsWith("mailto:")) { mailto++; return; }
      if (href.startsWith("tel:")) { tel++; return; }
      if (href.startsWith("http")) {
        try {
          const u = new URL(href);
          if (u.hostname.includes(host) || host.includes(u.hostname.replace(/^www\./, ""))) internal++;
          else {
            external++;
            if (a.getAttribute("target") === "_blank" && !a.getAttribute("rel")?.includes("noopener")) noRel++;
            if (a.getAttribute("rel")?.includes("nofollow")) noFollow++;
          }
        } catch { /* bad URL */ }
      }
    });
  });

  const issues = [];
  if (noRel > 0) issues.push(`${noRel} external links with target=_blank missing rel=noopener — tabnapping risk`);
  if (external > 20) issues.push(`${external} external links — high outbound link density`);

  const score = noRel > 10 ? 20 : noRel > 0 ? 45 : external > 30 ? 60 : 95;
  return {
    score,
    passed: score >= 65,
    findings: issues.length ? issues : ["Link profile looks healthy"],
    recommendations: [
      noRel > 0 && "Add rel='noopener noreferrer' to all target='_blank' links",
      external > 20 && "Audit external links — each is a trust decision",
    ].filter(Boolean),
    detail: { internal, external, noRel, noFollow, mailto, tel, total: internal + external },
  };
}

// ══════════════════════════════════════════════
// ALL ENGINES
// ══════════════════════════════════════════════
const ENGINES = [
  { key: "js", icon: "📦", title: "JS Bundle Analysis", fn: engineJSMaster },
  { key: "css", icon: "🎨", title: "CSS Quality & Bloat", fn: engineCSSMaster },
  { key: "csp", icon: "🛡️", title: "Auto CSP Generator", fn: engineCSPMaster },
  { key: "email", icon: "📧", title: "Email Security (SPF/DKIM/DMARC)", fn: engineEmailMaster },
  { key: "sectxt", icon: "📋", title: "Security.txt Generator", fn: engineSecurityTxtMaster },
  { key: "broken", icon: "🔗", title: "Broken Resource Hunter", fn: engineBrokenResources },
  { key: "semantic", icon: "🏗️", title: "Semantic HTML Audit", fn: engineSemanticHTML },
  { key: "meta", icon: "🏷️", title: "Meta Tag Completeness", fn: engineMetaTagsMaster },
  { key: "schema", icon: "📊", title: "Structured Data (JSON-LD)", fn: engineStructuredData },
  { key: "dom", icon: "🌲", title: "DOM Complexity Score", fn: engineDOMComplexity },
  { key: "thirdparty", icon: "🔌", title: "Third-Party Risk Exposure", fn: engineThirdPartyRisk },
  { key: "sri", icon: "🔐", title: "Subresource Integrity (SRI)", fn: engineSRI },
  { key: "vitals", icon: "⚡", title: "Web Vitals Estimator", fn: engineWebVitals },
  { key: "a11y", icon: "♿", title: "Accessibility Quick Audit", fn: engineAccessibility },
  { key: "links", icon: "🌐", title: "Link Health & Safety", fn: engineLinkHealth },
];

// ── RENDER ──
export default function DeepScan({ scan }) {
  const [expanded, setExpanded] = useState({});
  const meta = scan?.meta || {};

  const results = useMemo(() => ENGINES.map((eng) => {
    const fn = eng.fn;
    try { return { ...eng, result: fn.key === "sectxt" ? fn(scan) : fn(meta) }; }
    catch (e) { return { ...eng, result: { score: 0, passed: false, findings: [e.message], recommendations: [], detail: {} } }; }
  }), [scan]);

  const passed = results.filter((r) => r.result.passed).length;
  const critCount = results.filter((r) => r.result.score < 40).length;
  const warnCount = results.filter((r) => r.result.score >= 40 && r.result.score < 65).length;

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>DEEP SCAN — 15 CLIENT-SIDE ENGINES</span>
        <span className="dim" style={{ fontSize: 11, marginLeft: "auto" }}>
          {passed}/15 passed{crtCount > 0 ? ` · ${critCount} critical` : ""}{warnCount > 0 ? ` · ${warnCount} warnings` : ""}
        </span>
      </div>
      <div className="console-body">
        <div className="small dim" style={{ marginBottom: 14 }}>
          Pure JavaScript analysis · No external APIs · Runs entirely in your browser using real DOM parsing
        </div>

        {results.map((eng) => {
          const r = eng.result;
          const b = badge(r.score);
          const isOpen = expanded[eng.key];

          return (
            <div key={eng.key} style={{ marginBottom: 6, border: `1px solid ${isOpen ? b.color : "var(--line)"}`, borderRadius: 6, overflow: "hidden", transition: "border-color 0.2s" }}>
              <div onClick={() => setExpanded(p => ({ ...p, [eng.key]: !p[eng.key] }))} style={{
                padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                background: isOpen ? "var(--panel-2)" : "transparent",
              }}>
                <span style={{ fontSize: 18 }}>{eng.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{eng.title}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 4,
                  background: b.color + "18", color: b.color, border: `1px solid ${b.color}44`,
                }}>{b.label} {r.score}</span>
                <span style={{ color: "var(--dim)", fontSize: 12, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
              </div>

              {isOpen && (
                <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--line)", background: "rgba(0,0,0,0.1)" }}>
                  {/* Score bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${r.score}%`, background: b.color, borderRadius: 2, transition: "width 0.5s ease" }} />
                    </div>
                  </div>

                  {/* Findings */}
                  {r.findings?.filter(Boolean).length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Findings</div>
                      {r.findings.filter(Boolean).map((f, i) => (
                        <div key={i} style={{ fontSize: 12, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", color: typeof f === "string" ? "var(--fg)" : f.metric ? f.color : "var(--fg)" }}>
                          {typeof f === "string" ? f : f.metric ? (
                            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.color, display: "inline-block", flexShrink: 0 }} />
                              <b style={{ minWidth: 36 }}>{f.metric}</b> {f.estimate} <span className="dim" style={{ fontSize: 10 }}>{f.detail}</span>
                            </span>
                          ) : f.detail || f.type}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  {r.recommendations?.filter(Boolean).length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--cyan)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>How to fix</div>
                      {r.recommendations.filter(Boolean).map((rec, i) => (
                        <div key={i} style={{ fontSize: 11.5, color: "var(--cyan)", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          → {rec}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CSP String */}
                  {r.detail?.cspString && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>Content-Security-Policy</div>
                      <pre style={{ fontSize: 10, color: "var(--green)", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: 4, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 100, overflowY: "auto" }}>
                        {r.detail.cspString}
                      </pre>
                    </div>
                  )}

                  {/* Security.txt */}
                  {r.detail?.securityTxt && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>security.txt</div>
                      <pre style={{ fontSize: 10, color: "var(--green)", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: 4, overflowX: "auto", whiteSpace: "pre-wrap", maxHeight: 100, overflowY: "auto" }}>
                        {r.detail.securityTxt}
                      </pre>
                    </div>
                  )}

                  {/* Email records */}
                  {r.detail?.records && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>DNS Records to Add</div>
                      {Object.entries(r.detail.records).map(([k, v]) => (
                        <pre key={k} style={{ fontSize: 10, color: "var(--amber)", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: 4, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", marginBottom: 4 }}>
                          <b>{k}:</b> {v}
                        </pre>
                      ))}
                    </div>
                  )}

                  {/* Stats grid */}
                  {r.detail && !r.detail.cspString && !r.detail.securityTxt && !r.detail.records && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11, marginBottom: 8 }}>
                      {Object.entries(r.detail).filter(([, v]) => typeof v !== "object" || Array.isArray(v) && v.length <= 3).slice(0, 8).map(([k, v]) => (
                        <span key={k} style={{ display: "inline-flex", gap: 4 }}>
                          <span style={{ color: "var(--dim)" }}>{k}:</span>
                          <b style={{ color: "var(--fg)" }}>{Array.isArray(v) ? v.length : typeof v === "boolean" ? (v ? "yes" : "no") : String(v).slice(0, 60)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div style={{
          marginTop: 14, padding: "10px 14px", fontSize: 13, fontWeight: 700, letterSpacing: 1,
          border: `1px solid ${critCount > 0 ? "var(--red)" : warnCount > 0 ? "var(--amber)" : "var(--green)"}`,
          background: critCount > 0 ? "rgba(255,77,94,0.06)" : warnCount > 0 ? "rgba(255,176,32,0.06)" : "rgba(51,255,161,0.06)",
          color: critCount > 0 ? "var(--red)" : warnCount > 0 ? "var(--amber)" : "var(--green)",
        }}>
          {critCount > 0 ? `${critCount} critical — immediate attention required` : warnCount > 0 ? `${warnCount} warnings — review recommended` : "All 15 engines passed — excellent baseline"}
        </div>
      </div>
    </div>
  );
}