# Ownership Verification

To unlock the **Full Check** (active testing), SiteAudit requires proof that you control
the target website. This page documents every method, exact steps, and the technical
details of how the server validates each one.

---

## Why It Exists

Active scanning (SQL injection, XSS payloads, aggressive enumeration) can be damaging
and is illegal without authorization. Ownership proof is the product's legal gate: only
the person who can put a file, a tag, or a DNS record on the site can unlock these tests.

Passive scans do not require verification.

---

## Method Comparison

| Method | Custom domain needed? | Works on `*.vercel.app` / `*.netlify.app` / `*.pages.dev`? | Effort |
|--------|:---------------------:|:----------------------------------------------------------:|--------|
| **Token file upload** | No | Yes | Upload 1 file |
| **HTML meta tag** | No | Yes | Edit 1 line |
| **HTTP response header** | No | Yes | Add config file |
| DNS TXT record | Yes | No | 2 min in DNS panel |
| DNS CNAME record | Yes | No | 2 min in DNS panel |
| Email code | Yes | No | Check inbox |

**Default recommendation: token file upload** — it works for 100% of sites, including
vibe-coded apps on free subdomains, because anyone who can deploy the site can add a
file.

---

## 1. Token File Upload (Default)

**User steps**
1. Scanner generates a token, e.g. `SA3f9d2c1e8a4b0f6`.
2. Create `.well-known/siteaudit-verify.txt` containing exactly that token.
3. Put the file where the site's public root is served.

**Vercel**
- Vite/React project: add `.well-known/siteaudit-verify.txt` inside your `public/`
  folder, commit, and redeploy. Vercel serves `public/**` at the site root.
- No-code (drag-and-drop): Vercel Dashboard -> your project -> Deployments ->
  Files -> Upload -> create `.well-known/siteaudit-verify.txt`.

**Netlify / Cloudflare Pages**
- Same: place the file in the publish/static directory (Netlify `publish` dir,
  Cloudflare Pages `public` dir), redeploy.

**Any static host / plain server**
- Place the file in the web root, e.g. `/var/www/html/.well-known/siteaudit-verify.txt`,
  ensure the webserver serves dotfiles: `location /.well-known { }` in Nginx, or make
  sure Apache's `<FilesMatch>` doesn't block it.

**Validation** — the server requests
`https://<host>/.well-known/siteaudit-verify.txt` and compares the body (trimmed) with
the token. Must match byte-for-byte.

---

## 2. HTML Meta Tag

**User steps**
1. Add to the `<head>` of your homepage HTML:
   ```html
   <meta name="siteaudit-verification" content="SA3f9d2c1e8a4b0f6" />
   ```
2. Redeploy. For a Vite project, add it to `index.html`.

**Validation** — the server fetches the homepage, parses `<meta name=...>` elements,
and checks the `content` value against the token. (We do **not** match with regex on the
whole page, to avoid trivially-forged text anywhere on the site.)

---

## 3. HTTP Response Header

**User steps**
1. Vercel: create `vercel.json`:
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-SiteAudit-Token", "value": "SA3f9d2c1e8a4b0f6" }
         ]
       }
     ]
   }
   ```
2. Netlify: add to `netlify.toml`:
   ```toml
   [[headers]]
   for = "/*"
   [headers.values]
   X-SiteAudit-Token = "SA3f9d2c1e8a4b0f6"
   ```
3. Redeploy.

**Validation** — the server sends a `GET /` request and reads the
`X-SiteAudit-Token` response header. Works without a custom domain.

---

## 4. DNS TXT Record (Custom Domains)

**User steps**
1. At your DNS provider (Cloudflare DNS, Vercel Domains, Netlify DNS, GoDaddy, etc.),
   add a TXT record:
   ```
   Type:  TXT
   Name:  _siteaudit  (example.com -> _siteaudit.example.com)
   Value: siteaudit-verify=SA3f9d2c1e8a4b0f6
   TTL:   300
   ```
2. Wait up to a few minutes for propagation.

**Validation** — the server queries `TXT _siteaudit.<host>` (via a public DNS-over-HTTPS
resolver or `dns` library) and looks for `siteaudit-verify=<token>`. We use DoH so the
API server needs no special DNS privileges.

---

## 4b. DNS CNAME Record (Custom Domains)

**User steps**
1. At your DNS provider add a CNAME record:
   ```
   Type:  CNAME
   Name:  _siteaudit  (example.com -> _siteaudit.example.com)
   Value: siteaudit-verify-<token>.verify.sa
   TTL:   300
   ```
2. Wait up to a few minutes for propagation.

**Validation** — the server queries `CNAME _siteaudit.<host>` via DoH and checks the
canonical target. Requires the user to control DNS for the domain.

---

## 5. Email Code (Custom Domains)

**User steps**
1. Scanner sends a 6-digit code to `admin@<host>` (via SendGrid when
   `SENDGRID_API_KEY` + `EMAIL_FROM` are configured on the server; otherwise the method
   is disabled and hidden in the UI).
2. User clicks the magic link in the email (`/verify/confirm?v=...&c=...`) or enters the
   code in the UI.

**Validation** — one-time-use code matched on the server within its expiry window; the
magic-link route marks the scan verified instantly.

> Note: only works for domains with a real mailbox on `admin@`. If no working address
> exists, fall back to the token file method.

---

## Technical Flow (Server)

```
1. POST /verify/challenge  -> generate token (128-bit, hex)
2. Store token hashed (SHA-256) in verifications table (expiry = +1 hour)
3. Return token + method-specific instructions to the UI
4. UI polls POST /verify/check  (user triggers after placing token)
5. Server fetches/validates per method (see above)
6. On success: verifications.status = 'verified', scans.verified = 1
7. FullCheckButton unlocks in the UI
```

**Anti-bypass rules**
- Token is only shown **once** after challenge creation; stored only as a hash.
- The check must fetch from the **target itself** — a screenshot or self-reported
  confirmation is never accepted.
- Tokens expire after 1 hour; user can request a new one.
- Verification is bound to a single host; changing host invalidates it.

---

## Common Issues

| Symptom | Cause / Fix |
|---------|-------------|
| "Token not found" for token file | File served at wrong path; check `https://<host>/.well-known/siteaudit-verify.txt` in a browser. Vercel `public/` path is `.well-known/...` (dotfolder kept). |
| 404 on `.well-known` | Some hosts ignore dotfiles — use the meta-tag or header method instead. |
| Meta tag not detected | Token must be in the `<head>` `content` attribute exactly; redeploy and hard-refresh. |
| Header method on static-only host | Header needs a config file (`vercel.json` / `netlify.toml`); if the host can't do headers, use file or meta. |
| DNS TXT not propagating | Check with `nslookup -type=TXT _siteaudit.example.com` or `dig`; wait for TTL. |
| Vercel override warning | `.well-known` may conflict with Vercel-managed files — you may need to place the file in `public/` and it will take precedence; if not, use meta/header method. |
