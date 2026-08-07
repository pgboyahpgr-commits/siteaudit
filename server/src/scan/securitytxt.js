import { httpGet } from "./http.js";

const RFC9116_FIELDS = {
  contact: { required: true, desc: "Point of contact for security researchers" },
  expires: { required: true, desc: "Date/time when this security.txt expires" },
  encryption: { required: false, desc: "PGP/GPG key for encrypted communication" },
  acknowledgments: { required: false, desc: "URL to hall of fame / acknowledgments page" },
  preferredLanguages: { required: false, desc: "Preferred languages for communication" },
  canonical: { required: false, desc: "Canonical URL for this security.txt" },
  policy: { required: false, desc: "URL to security policy / disclosure policy" },
  hiring: { required: false, desc: "URL to security-related job openings" },
};

export async function parseSecurityTxt(targetUrl) {
  const origin = new URL(targetUrl).origin;
  const url = `${origin}/.well-known/security.txt`;
  const result = {
    present: false,
    url,
    fields: {},
    issues: [],
    score: 0,
    raw: "",
  };

  const res = await httpGet(url, { timeout: 10000 });
  if (!res.ok || res.status !== 200) {
    // Try root path
    const res2 = await httpGet(`${origin}/security.txt`, { timeout: 10000 });
    if (!res2.ok || res2.status !== 200) {
      result.issues.push("security.txt not found at /.well-known/security.txt or /security.txt");
      return result;
    }
    result.raw = res2.text || "";
    result.url = `${origin}/security.txt`;
  } else {
    result.raw = res.text || "";
  }

  result.present = true;
  const lines = result.raw.split(/\r?\n/);

  // Parse fields
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    if (RFC9116_FIELDS[key]) {
      result.fields[key] = value;
    }
  }

  // Validate required fields
  for (const [key, field] of Object.entries(RFC9116_FIELDS)) {
    if (field.required && !result.fields[key]) {
      result.issues.push(`Missing required field: "${key}" — ${field.desc}`);
    }
  }

  // Validate expires format
  if (result.fields.expires) {
    const expDate = new Date(result.fields.expires);
    if (isNaN(expDate.getTime())) {
      result.issues.push("Expires field is not a valid ISO-8601 date");
    } else if (expDate < new Date()) {
      result.issues.push("security.txt has EXPIRED — update immediately");
    } else {
      const daysLeft = Math.ceil((expDate - Date.now()) / 86400000);
      if (daysLeft < 30) result.issues.push(`security.txt expires in ${daysLeft} days — renew soon`);
    }
  }

  // Check for canonical URL
  if (!result.fields.canonical) {
    result.issues.push("Missing 'Canonical' field — helps prevent duplicate/outdated copies");
  }

  // Check contact has proper URI format (mailto: or https:)
  if (result.fields.contact && !result.fields.contact.startsWith("mailto:") && !result.fields.contact.startsWith("https://")) {
    result.issues.push("Contact field should start with mailto: or https:// for discoverability");
  }

  // Score
  result.score = 100;
  for (const [key, field] of Object.entries(RFC9116_FIELDS)) {
    if (field.required && !result.fields[key]) result.score -= 30;
  }
  if (result.fields.expires) {
    const expDate = new Date(result.fields.expires);
    if (!isNaN(expDate.getTime()) && expDate < new Date()) result.score -= 25;
  }
  if (!result.fields.encryption) result.score -= 5;
  if (!result.fields.policy) result.score -= 5;
  result.score = Math.max(0, Math.min(100, result.score));

  return result;
}
