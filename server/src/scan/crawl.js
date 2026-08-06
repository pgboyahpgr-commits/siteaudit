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

export async function crawl(targetUrl, { maxPages = 25, concurrency = 4, pacingMs = 120, onProgress } = {}) {
  const start = normalizeUrl(targetUrl);
  if (!start) throw new Error("Invalid target URL");

  const queue = [start.href];
  const visited = new Set();
  const pages = [];
  const jsFiles = [];
  const allAssets = new Set();
  const baseHost = start.hostname;

  const fetchPage = async (url) => {
    if (visited.has(url)) return;
    visited.add(url);
    await sleep(pacingMs);
    const res = await httpGet(url, { timeout: 15000 });
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
      info.html = res.text.slice(0, 200000);

      for (const a of parsed.assets) {
        allAssets.add(a);
        if (a.match(/\.js(\?|#|$)/i)) jsFiles.push(a);
      }
      for (const u of parsed.urls) {
        if (sameHost(u, start.href) && !visited.has(u)) queue.push(u);
      }
    }
    pages.push(info);
    onProgress?.(pages.length);
  };

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length && visited.size < maxPages + 1) {
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
