export const HERO_ART = String.raw`
 ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
 █ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄ █
 █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
 █ █▄█ █▄▄ █▄█ █▄█ █▄█ █▄▄ █▄█ █▄█ █▄█ █▄▄ █▄█ █▄█ █▄█ █▄█ █
 █ ▄▄█ █▄▄ █▄█ ▄▄█ █▄█ █▄▄ █▄█ █▄▄ █▄█ █▄▄ █▄█ █▄█ █▄█ █▄█ █
 █ █ █ ▄▄▄ █▄█ █ █ █▄▄ ▄▄▄ █▄▄ █▄▄ █▄▄ █▄▄ █▄█ █▄█ █▄▄ █▄█ █
 █ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █▄█ █
 ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
`;

export function severityColor(sev) {
  return { critical: "#ff4d5e", high: "#ff2d95", medium: "#ffb020", low: "#38e1ff", info: "#7f92b8" }[sev] || "#7f92b8";
}

export function scoreColor(score) {
  if (score == null) return "#38e1ff";
  if (score >= 80) return "#33ffa1";
  if (score >= 50) return "#ffb020";
  return "#ff4d5e";
}

export const SEV_ORDER = ["critical", "high", "medium", "low", "info"];

export const PHASE_PILLS = {
  discovery: "DISCOVERY",
  fingerprint: "FINGERPRINT",
  headers: "HEADERS/TLS",
  tls: "TLS",
  enumeration: "ENUMERATION",
  source: "SOURCE REVIEW",
  done: "COMPLETE",
};
