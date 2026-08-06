import { httpGet } from "./http.js";
import { hashToken } from "../store.js";

const DEOH_URL = "https://cloudflare-dns.com/dns-query";

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
        const paths = ["/.well-known/siteaudit-verify.txt", "/siteaudit-verify.txt", "/verify.txt"];
        let body = "";
        let tried = "";
        for (const p of paths) {
          tried = `${origin}${p}`;
          const res = await httpGet(tried, { timeout: 12000 });
          if (res.ok) {
            body = (res.text || "").trim();
            break;
          }
        }
        if (body === token) return ok(verification);
        const looksLikeHtml = /^<!doctype|^<html|<script|<head/i.test(body);
        if (looksLikeHtml) {
          return {
            ok: false,
            reason: `Your site is serving its app page (index.html) at ${tried} — the token file isn't being served. Add the file to your project's public/ or static folder and redeploy (on Vercel it must be inside public/), or use the Meta Tag method instead.`,
          };
        }
        return { ok: false, reason: `Token file not found. We checked ${tried} (got "${body.slice(0, 40) || "empty"}"). Make sure the file contains exactly: ${token}` };
      }
      case "meta": {
        const res = await httpGet(`${origin}/`, { timeout: 12000 });
        const re = new RegExp(`<meta[^>]+name=["']siteaudit-verification["'][^>]+content=["']${token}["']`, "i");
        if (re.test(res.text || "")) return ok(verification);
        return { ok: false, reason: "Meta tag not found. Add <meta name=\"siteaudit-verification\" content=\"" + token + "\"> to the homepage <head> and redeploy." };
      }
      case "header": {
        const res = await httpGet(`${origin}/`, { timeout: 12000 });
        const val = res.headers?.get?.("x-siteaudit-token") || res.headers?.["x-siteaudit-token"];
        if (val && String(val).trim() === token) return ok(verification);
        return { ok: false, reason: "Header not found. Add X-SiteAudit-Token: " + token + " via vercel.json / netlify.toml and redeploy." };
      }
      case "dns": {
        const records = await queryDns(host, "TXT");
        if (records.some((r) => r === `siteaudit-verify=${token}`)) return ok(verification);
        return { ok: false, reason: "TXT record not found. Add TXT _siteaudit." + host + " with value siteaudit-verify=" + token + " and wait for propagation." };
      }
      case "cname": {
        const records = await queryDns(host, "CNAME");
        const expected = `siteaudit-verify-${token.toLowerCase()}.verify.sa.`;
        if (records.some((r) => String(r).toLowerCase() === expected)) return ok(verification);
        return { ok: false, reason: "CNAME record not found. Add CNAME _siteaudit." + host + " -> " + expected + " and wait for propagation." };
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
