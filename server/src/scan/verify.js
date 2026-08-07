import { httpGet } from "./http.js";
import { hashToken } from "../store.js";

const DEOH_URL = "https://cloudflare-dns.com/dns-query";

// Browser-like user agent to avoid bot blocking
const BROWSER_UA = "Mozilla/5.0 (compatible; SiteAuditVerifier/1.0; +https://siteaudit-six.vercel.app)";

async function queryDns(host, type) {
  const name = `_siteaudit.${host}`;
  const res = await fetch(`${DEOH_URL}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const answers = data?.Answer || [];
  if (type === "TXT") {
    return answers.filter((a) => a.type === 16).map((a) => a.data.replace(/^"|"$/g, ""));
  }
  if (type === "CNAME") {
    return answers.filter((a) => a.type === 5).map((a) => String(a.data).replace(/\.$/, ""));
  }
  return [];
}

export function emailConfigured() {
  return !!(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail(to, subject, text) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.EMAIL_FROM },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid error ${res.status}`);
  return true;
}

export async function sendVerificationEmail(host, code, confirmUrl) {
  const addr = `admin@${host}`;
  const text = `You are verifying ownership of ${host} on SiteAudit.\n\nYour verification code is: ${code}\n\nOr click this link to verify instantly:\n${confirmUrl}\n\nIf you did not request this, ignore this email.`;
  await sendEmail(addr, `[SiteAudit] Verify ownership of ${host}`, text);
  return addr;
}

function isSpaIndex(body) {
  if (!body) return false;
  const lower = body.toLowerCase().slice(0, 500);
  return /^<!doctype|<html|<head|<title|<script|<link|<meta charset/i.test(lower) && (
    body.includes("id=\"root\"") ||
    body.includes("id='root'") ||
    body.includes("data-reactroot") ||
    body.includes("__NEXT_DATA__") ||
    body.includes("vue") ||
    body.includes("_next") ||
    body.includes("/static/js/")
  );
}

export async function validateToken(verification, token) {
  if (hashToken(token) !== verification.tokenHash) return { ok: false, reason: "Token mismatch" };
  if (new Date(verification.expiresAt) < new Date()) {
    return { ok: false, reason: "Token expired. Request a new one." };
  }
  if (verification.status === "verified") return { ok: true, verifiedAt: verification.verifiedAt };

  const host = new URL(verification.targetUrl).hostname;
  const origin = new URL(verification.targetUrl).origin;

  try {
    switch (verification.method) {
      case "file": {
        const paths = [
          { path: "/.well-known/siteaudit-verify.txt", label: "/.well-known/siteaudit-verify.txt" },
          { path: "/siteaudit-verify.txt", label: "/siteaudit-verify.txt" },
          { path: "/verify.txt", label: "/verify.txt" },
        ];
        let body = "";
        let tried = "";
        let triedLabel = "";
        for (const p of paths) {
          tried = `${origin}${p.path}`;
          triedLabel = p.label;
          const res = await httpGet(tried, { timeout: 12000, headers: { "user-agent": BROWSER_UA } });
          if (res.ok && res.status !== 404) {
            body = (res.text || "").trim();
            // If the site returns its HTML (SPA catch-all), the token file isn't actually there
            if (body !== token && isSpaIndex(body)) continue;
            break;
          }
        }
        if (body === token) return ok(verification);
        if (isSpaIndex(body)) {
          return {
            ok: false,
            reason: `SPA detected — your site serves index.html for all URLs including ${triedLabel}. SPA hosts (Vercel, Netlify, Cloudflare Pages) need the token file in public/ or static/ folder. Upload "siteaudit-verify.txt" with content ${token} to your project's public/ folder and redeploy. Or use the META TAG method instead.`,
          };
        }
        return { ok: false, reason: `Token file not found at ${triedLabel}. We got "${body.slice(0, 40) || "empty message"}". Upload a file with content "${token}" at ${triedLabel}.` };
      }
      case "meta": {
        const res = await httpGet(`${origin}/`, { timeout: 12000, headers: { "user-agent": BROWSER_UA } });
        const re = new RegExp(`<meta[^>]+name=["']siteaudit-verification["'][^>]+content=["']${token}["']`, "i");
        if (re.test(res.text || "")) return ok(verification);
        const hasHead = /<head[^>]*>/i.test(res.text || "");
        if (!hasHead) {
          return { ok: false, reason: "Could not find a <head> tag on the homepage. Are you sure this is a real site? If it's an SPA, the meta tag must be in the source HTML (not added by JavaScript)." };
        }
        return { ok: false, reason: "Meta tag not found. Add <meta name=\"siteaudit-verification\" content=\"" + token + "\"> inside the <head> of your homepage and redeploy." };
      }
      case "header": {
        const res = await httpGet(`${origin}/`, { timeout: 12000, headers: { "user-agent": BROWSER_UA } });
        const val = res.headers?.get?.("x-siteaudit-token") || res.headers?.["x-siteaudit-token"];
        if (val && String(val).trim() === token) return ok(verification);
        return { ok: false, reason: "Header not found. Set X-SiteAudit-Token: " + token + " in vercel.json headers, netlify.toml, or your server config and redeploy." };
      }
      case "dns": {
        const records = await queryDns(host, "TXT");
        if (records.some((r) => r === `siteaudit-verify=${token}`)) return ok(verification);
        return { ok: false, reason: "TXT record not found. Add TXT _siteaudit." + host + " with value siteaudit-verify=" + token + " at your DNS provider. Wait 2-5 minutes for propagation, then try again." };
      }
      case "cname": {
        const records = await queryDns(host, "CNAME");
        const expected = `siteaudit-verify-${token.toLowerCase()}.verify.sa.`;
        if (records.some((r) => String(r).toLowerCase() === expected)) return ok(verification);
        return { ok: false, reason: "CNAME record not found. Add CNAME _siteaudit." + host + " -> " + expected + " at your DNS provider. Wait 2-5 minutes for propagation, then try again." };
      }
      case "email": {
        return ok(verification);
      }
      default:
        return { ok: false, reason: "Unsupported method" };
    }
  } catch (err) {
    return { ok: false, reason: `Validation error: ${err.message}` };
  }
}

function ok(verification) {
  const verifiedAt = new Date().toISOString();
  return { ok: true, verifiedAt, verificationId: verification.id };
}
