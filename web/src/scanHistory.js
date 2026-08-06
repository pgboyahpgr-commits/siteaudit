const KEY = "sa_scan_history";

export function saveScanToHistory(scan) {
  try {
    const history = JSON.parse(localStorage.getItem(KEY) || "[]");
    const exists = history.findIndex((s) => s.scanId === scan.scanId);
    const entry = {
      scanId: scan.scanId,
      targetUrl: scan.targetUrl,
      host: scan.host,
      score: scan.score,
      mode: scan.mode,
      status: scan.status,
      findingsCount: scan.findings?.length || 0,
      findingsSummary: scan.findingsSummary,
      tech: scan.meta?.tech || [],
      pagesCrawled: scan.meta?.pagesCrawled || 0,
      endpointsCount: scan.meta?.endpointCount || 0,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    };
    if (exists >= 0) history[exists] = entry;
    else history.unshift(entry);
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, 50)));
  } catch { /* localStorage full or disabled */ }
}

export function getScanHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function deleteScanFromHistory(scanId) {
  const history = getScanHistory().filter((s) => s.scanId !== scanId);
  localStorage.setItem(KEY, JSON.stringify(history));
}

export function clearScanHistory() {
  localStorage.setItem(KEY, "[]");
}
