const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (localStorage.getItem("sa_token")) {
    headers.authorization = `Bearer ${localStorage.getItem("sa_token")}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  createScan: (payload) => request("/scan", { method: "POST", body: payload }),
  getScan: (id) => request(`/scan/${id}`),
  getFindings: (id) => request(`/scan/${id}/findings`),
  getHostInfo: (id) => request(`/scan/${id}/host-info`),
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
