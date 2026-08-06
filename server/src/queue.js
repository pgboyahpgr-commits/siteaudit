import { runScan } from "./scan/engine.js";
import { getScan, updateScan, setScanFindings, saveReport } from "./store.js";

const queue = [];
let processing = false;

export function enqueue(scanId) {
  queue.push(scanId);
  void processQueue();
}

export function queueLength() {
  return queue.length;
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length) {
      const id = queue.shift();
      const scan = getScan(id);
      if (!scan) continue;
      if (scan.status !== "queued") continue;
      updateScan(id, {
        status: "running",
        progress: { phase: "discovery", phaseIndex: 1, phasesTotal: 8, message: "Starting..." },
      });

      const phaseNames = ["discovery", "fingerprint", "headers", "tls", "enumeration", "source"];
      try {
        const result = await runScan(scan, (phaseIndex, phase, message) => {
          updateScan(id, {
            progress: { phase, phaseIndex, phasesTotal: 6, message },
          });
        });
        setScanFindings(id, result.findings, result.score);
        const report = saveReport(id, ["json", "html"]);
        updateScan(id, { reportId: report?.reportId, meta: result.meta });
        try {
          const { ensureAiAnalysis } = await import("./ai/ai.js");
          void ensureAiAnalysis(id);
        } catch {
          /* AI analysis is non-critical */
        }
      } catch (err) {
        updateScan(id, {
          status: "failed",
          error: err.message || "Scan failed",
          progress: { phase: "failed", phaseIndex: 0, phasesTotal: 6, message: "Scan failed: " + (err.message || "unknown error") },
        });
      }
    }
  } finally {
    processing = false;
  }
}
