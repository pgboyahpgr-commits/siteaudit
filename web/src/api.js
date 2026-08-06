const BASE = import.meta.env.VITE_API_URL || "/api";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (localStorage.getItem("sa_token")) {
    headers.authorization = `Bearer ${localStorage.getItem("sa_token")}`;
  }
  const savedSettings = localStorage.getItem("sa_settings");
  if (savedSettings) {
    try {
      headers["x-sa-settings"] = btoa(savedSettings);
    } catch {}
  }
  const isGetOrHead = !options.method || options.method === "GET" || options.method === "HEAD";
  const maxRetries = isGetOrHead ? 0 : 3;
  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data?.error?.message || `Request failed (${res.status})`);
        err.code = data?.error?.code;
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (err.name === "AbortError") {
        lastErr = new Error("The server is waking up from sleep. Retrying...");
      }
      if (attempt < maxRetries) {
        const delay = Math.min(2000 * (attempt + 1), 8000);
        if (attempt > 0 && !isGetOrHead && lastErr.message.includes("waking")) {
          await sleep(delay);
        }
        await sleep(800);
      }
    }
  }

  throw lastErr || new Error("Failed to fetch. Please try again.");
}

export async function warmUpBackend() {
  try {
    await request("/health");
    return true;
  } catch {
    return false;
  }
}

export const api = {
  createScan: (payload) => request("/scan", { method: "POST", body: payload }),
  getScan: (id) => request(`/scan/${id}`),
  getFindings: (id) => request(`/scan/${id}/findings`),
  getHostInfo: (id) => request(`/scan/${id}/host-info`),
  getVideos: (id, q) => request(`/scan/${id}/videos${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getVision: (id) => request(`/scan/${id}/vision`),
  agent: (message, scanId, history) => request("/agent", { method: "POST", body: { message, scanId: scanId || undefined, history } }),
  getAi: (id, refresh) => request(`/scan/${id}/ai${refresh ? "?refresh=1" : ""}`),
  saveScan: (id) => request(`/scan/${id}/save`, { method: "POST", body: {} }),
  chat: (id, question) => request(`/scan/${id}/chat`, { method: "POST", body: { question } }),
  runFull: (id) => request(`/scan/${id}/full`, { method: "POST" }),
  getVerifyConfig: () => request("/verify/config"),
  challenge: (scanId, method) => request("/verify/challenge", { method: "POST", body: { scanId, method } }),
  verifyCheck: (verificationId, token) => request("/verify/check", { method: "POST", body: { verificationId, token } }),
  getReport: (reportId) => request(`/report/${reportId}`),
  getReports: () => request("/reports"),
  register: (email, password) => request("/auth/register", { method: "POST", body: { email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/me"),
  myScans: () => request("/my/scans"),
  saveSettings: (settings) => request("/settings", { method: "POST", body: settings }),
  getSettings: () => request("/settings"),
};

export function setToken(token) {
  if (token) localStorage.setItem("sa_token", token);
  else localStorage.removeItem("sa_token");
}

export function getToken() {
  return localStorage.getItem("sa_token");
}

export function logout() {
  localStorage.removeItem("sa_token");
}
