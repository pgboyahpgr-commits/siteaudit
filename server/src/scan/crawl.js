import { httpGet, normalizeUrl, sameHost, sleep } from "./http.js";

const ATTR_ABS = /(href|src|action|data-url|srcset)="([^"]+)"/gi;
const META_GENERATOR = /<meta[^>]+(?:name|property)="generator"[^>]+content="([^"]+)"[^>]*>/i;
const TITLE = /<title[^>]*>([^<]*)<\/title>/i;
const SRC_ABS = /<script[^>]+src="([^"]+)"/gi;
const LINK_ABS = /<link[^>]+href="([^"]+)"/gi;

function absolute(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function scrub(href) {
  try {
    const u = new URL(href);
    u.hash = "";
    return u.href;
  } catch {
    return href;
  }
}

const UTM_PARAMS = /^(?:utm_(?:source|medium|campaign|term|content|id)|fbclid|gclid|msclkid|ref|source)$/i;

function normalizeForDedup(href) {
  try {
    const u = new URL(href);
    u.hash = "";
    u.searchParams.forEach((_, key) => {
      if (UTM_PARAMS.test(key)) u.searchParams.delete(key);
    });
    if (u.hostname.startsWith("www.")) u.hostname = u.hostname.slice(4);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      u.pathname = path.slice(0, -1);
    }
    return u.href;
  } catch {
    return href;
  }
}

function extractAll(html, base) {
  const urls = new Set();
  const assets = new Set();
  let m;
  ATTR_ABS.lastIndex = 0;
  while ((m = ATTR_ABS.exec(html))) {
    const href = m[2];
    if (href.startsWith("data:") || href.startsWith("javascript:")) continue;
    const abs = absolute(base, href);
    if (!abs) continue;
    const src = m[1];
    if (src === "src" || href.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|map)(\?|#|$)/i)) {
      assets.add(scrub(abs));
    }
    urls.add(scrub(abs));
  }
  SRC_ABS.lastIndex = 0;
  while ((m = SRC_ABS.exec(html))) {
    const abs = absolute(base, m[1]);
    if (abs) assets.add(scrub(abs));
  }
  LINK_ABS.lastIndex = 0;
  while ((m = LINK_ABS.exec(html))) {
    const abs = absolute(base, m[1]);
    if (abs && m[1].match(/\.(css|json|xml|txt)(\?|#|$)/i)) assets.add(scrub(abs));
  }
  return { urls: [...urls], assets: [...assets] };
}

export function parseHtml(html, base) {
  const metaGen = html.match(META_GENERATOR);
  const title = html.match(TITLE);
  const { urls, assets } = extractAll(html, base);
  return {
    title: title ? title[1].trim().slice(0, 200) : "",
    generator: metaGen ? metaGen[1] : null,
    urls,
    assets,
  };
}

export async function crawl(targetUrl, { maxPages = 50, concurrency = 4, pacingMs = 120, maxSize = 400000, onProgress } = {}) {
  const start = normalizeUrl(targetUrl);
  if (!start) throw new Error("Invalid target URL");

  const queue = [start.href];
  const visited = new Set();
  const discovered = new Set([normalizeForDedup(start.href)]);
  const pages = [];
  const jsFiles = [];
  const allAssets = new Set();
  const baseHost = start.hostname;

  const fetchPage = async (url) => {
    const dedupKey = normalizeForDedup(url);
    if (visited.has(dedupKey)) return;
    visited.add(dedupKey);
    visited.add(url);
    await sleep(pacingMs);
    const res = await httpGet(url, { timeout: 20000 });
    const info = {
      url,
      status: res.status,
      ok: res.ok,
      redirected: res.redirected,
      finalUrl: res.url,
      title: "",
      generator: null,
      headers: res.headers ? Object.fromEntries(res.headers.entries()) : {},
      html: "",
    };
    if (res.text) {
      const parsed = parseHtml(res.text, url);
      info.title = parsed.title;
      info.generator = parsed.generator;
      info.html = res.text.slice(0, maxSize);

      for (const a of parsed.assets) {
        allAssets.add(a);
        if (a.match(/\.js(\?|#|$)/i)) jsFiles.push(a);
      }
      for (const u of parsed.urls) {
        const norm = normalizeForDedup(u);
        if (sameHost(u, start.href) && !discovered.has(norm)) {
          discovered.add(norm);
          queue.push(u);
        }
      }
    }
    pages.push(info);
    onProgress?.({ crawled: pages.length, remaining: queue.length, discovered: discovered.size });
  };

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length && pages.length < maxPages) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      try {
        await fetchPage(url);
      } catch {
        /* keep going */
      }
      if (pages.length >= maxPages) break;
    }
  });

  await Promise.all(workers);

  return { baseUrl: start.href, host: baseHost, pages, jsFiles: [...new Set(jsFiles)], assets: [...allAssets] };
}
