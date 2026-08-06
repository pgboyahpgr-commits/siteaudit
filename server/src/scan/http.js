const USER_AGENT =
  "SiteAuditBot/0.1 (+security research; scanner that only tests authorized targets)";

export async function httpGet(url, { timeout = 12000, headers = {}, method = "GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers: { "user-agent": USER_AGENT, ...headers },
      body,
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      text,
      url: res.url || url,
      redirected: res.redirected,
    };
  } catch (err) {
    return { ok: false, status: 0, error: err.message || "network error", text: "", headers: null };
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

export function sameHost(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.hostname.toLowerCase() === ub.hostname.toLowerCase();
  } catch {
    return false;
  }
}
