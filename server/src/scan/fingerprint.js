export function fingerprintFromPage(page) {
  const tech = new Map();
  const headers = page.headers || {};
  const html = page.html || "";
  const lower = html.toLowerCase();
  const server = headers["server"];
  const powered = headers["x-powered-by"];

  function v(re) {
    const m = html.match(re);
    return m ? m[1] || m[0] : null;
  }

  if (server) {
    if (/nginx/i.test(server)) tech.set("Nginx", server.match(/\d+(\.\d+)+/)?.[0] || null);
    if (/apache/i.test(server)) tech.set("Apache", server.match(/\d+(\.\d+)+/)?.[0] || null);
    if (/cloudflare/i.test(server)) tech.set("Cloudflare", null);
    if (/vercel/i.test(server)) tech.set("Vercel", null);
    if (/netlify/i.test(server)) tech.set("Netlify", null);
    if (!server.match(/nginx|apache|cloudflare|vercel|netlify/i)) tech.set(server, null);
  }
  if (powered) tech.set(powered, null);

  if (page.generator) {
    const genVer = page.generator.match(/\d+(\.\d+)+/)?.[0];
    tech.set(page.generator, genVer || null);
  }

  if (lower.includes("wp-content") || lower.includes("wp-includes")) tech.set("WordPress", v(/wordpress[/\- ]?(\d+\.\d+(?:\.\d+)?)/i) || v(/wp-embed\.min\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i));
  if (lower.includes("id=\"root\"") || lower.includes("data-reactroot")) tech.set("React", v(/react[/\-@]?(\d+\.\d+\.\d+)/i) || v(/react\.production(?:\.min)?\.js.+?(\d+\.\d+\.\d+)/i));
  if (lower.includes("ng-version") || lower.includes("ng-app")) tech.set("Angular", v(/ng-version=["'](\d+\.\d+\.\d+)/i) || v(/angular[/\-@]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("vue")) tech.set("Vue.js", v(/vue[/\-@]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("shopify")) tech.set("Shopify", null);
  if (lower.includes("drupal")) tech.set("Drupal", v(/drupal[/\-@ ]?(\d+\.\d+(?:\.\d+)?)/i));
  if (lower.includes("joomla")) tech.set("Joomla", v(/joomla[/\-@ ]?(\d+\.\d+(?:\.\d+)?)/i));
  if (lower.includes("bootstrap")) tech.set("Bootstrap", v(/bootstrap[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("tailwind")) tech.set("Tailwind CSS", v(/tailwindcss[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("jquery")) tech.set("jQuery", v(/jquery[/\-@ ]?(\d+\.\d+\.\d+)/i) || v(/jquery\.min\.js\?v=(\d+\.\d+\.\d+)/i));
  if (lower.includes("next-data")) tech.set("Next.js", v(/next[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("gatsby")) tech.set("Gatsby", v(/gatsby[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("svelte")) tech.set("Svelte", v(/svelte[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("astro")) tech.set("Astro", v(/astro[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("php")) tech.set("PHP", v(/php[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("asp.net")) tech.set("ASP.NET", v(/asp\.net[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("laravel")) tech.set("Laravel", v(/laravel[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("django")) tech.set("Django", v(/django[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("flask")) tech.set("Flask", v(/flask[/\-@ ]?(\d+\.\d+\.\d+)/i));
  if (lower.includes("express")) tech.set("Express", v(/express[/\-@ ]?(\d+\.\d+\.\d+)/i));

  const services = [];

  // Analytics & Tracking
  if (lower.includes("gtag") || lower.includes("analytics.js") || lower.includes("ga.js") || lower.includes("googletagmanager.com") || /g-[\w]{8,}/.test(lower)) services.push({ name: "Google Analytics", category: "Analytics" });
  if (lower.includes("fbq(") || lower.includes("connect.facebook.net")) services.push({ name: "Facebook Pixel", category: "Analytics" });
  if (lower.includes("mixpanel") || lower.includes("cdn.mxpnl.com")) services.push({ name: "Mixpanel", category: "Analytics" });
  if (lower.includes("amplitude") || lower.includes("cdn.amplitude.com")) services.push({ name: "Amplitude", category: "Analytics" });
  if (lower.includes("hotjar") || lower.includes("static.hotjar.com")) services.push({ name: "Hotjar", category: "Analytics" });
  if (lower.includes("plausible.io")) services.push({ name: "Plausible", category: "Analytics" });
  if (lower.includes("fathom") || lower.includes("cdn.usefathom.com")) services.push({ name: "Fathom", category: "Analytics" });
  if (lower.includes("posthog")) services.push({ name: "PostHog", category: "Analytics" });
  if (lower.includes("segment.com") || lower.includes("cdn.segment.com")) services.push({ name: "Segment", category: "Analytics" });
  if (lower.includes("heapanalytics")) services.push({ name: "Heap", category: "Analytics" });

  // Ad Networks
  if (lower.includes("adsbygoogle") || lower.includes("googlesyndication") || lower.includes("pagead2")) services.push({ name: "Google AdSense", category: "Ads" });
  if (lower.includes("googleadservices") || lower.includes("doubleclick")) services.push({ name: "Google AdWords", category: "Ads" });
  if (lower.includes("facebook.com/tr")) services.push({ name: "Facebook Ads", category: "Ads" });
  if (lower.includes("amazon-adsystem")) services.push({ name: "Amazon Ads", category: "Ads" });
  if (lower.includes("taboola")) services.push({ name: "Taboola", category: "Ads" });
  if (lower.includes("outbrain")) services.push({ name: "Outbrain", category: "Ads" });
  if (lower.includes("media.net")) services.push({ name: "Media.net", category: "Ads" });

  // Payment & E-commerce
  if (lower.includes("stripe") || lower.includes("js.stripe.com")) services.push({ name: "Stripe", category: "Payments" });
  if (lower.includes("paypal") || lower.includes("paypalobjects.com")) services.push({ name: "PayPal", category: "Payments" });
  if (lower.includes("squareup") || lower.includes("js.squarecdn.com")) services.push({ name: "Square", category: "Payments" });
  if (lower.includes("shopify-buy") || lower.includes("cdn.shopify.com")) services.push({ name: "Shopify", category: "Payments" });
  if (lower.includes("lemonsqueezy")) services.push({ name: "Lemon Squeezy", category: "Payments" });
  if (lower.includes("gumroad")) services.push({ name: "Gumroad", category: "Payments" });
  if (lower.includes("razorpay")) services.push({ name: "Razorpay", category: "Payments" });

  // Chat & Support widgets
  if (lower.includes("intercom") || lower.includes("js.intercomcdn.com")) services.push({ name: "Intercom", category: "Chat" });
  if (lower.includes("zendesk") || lower.includes("zdassets.com")) services.push({ name: "Zendesk", category: "Chat" });
  if (lower.includes("driftt") || lower.includes("js.driftt.com")) services.push({ name: "Drift", category: "Chat" });
  if (lower.includes("tawk.to")) services.push({ name: "Tawk.to", category: "Chat" });
  if (lower.includes("crisp.chat")) services.push({ name: "Crisp", category: "Chat" });
  if (lower.includes("livechatinc")) services.push({ name: "LiveChat", category: "Chat" });
  if (lower.includes("hubspot") || lower.includes("js.hs-scripts.com")) services.push({ name: "HubSpot", category: "Chat" });

  // Email & Marketing
  if (lower.includes("mailchimp") || lower.includes("mc.yandex")) services.push({ name: "Mailchimp", category: "Marketing" });
  if (lower.includes("sendgrid")) services.push({ name: "SendGrid", category: "Marketing" });
  if (lower.includes("klaviyo") || lower.includes("klaviyo.com")) services.push({ name: "Klaviyo", category: "Marketing" });
  if (lower.includes("convertkit")) services.push({ name: "ConvertKit", category: "Marketing" });

  // CDN & Infrastructure
  if (lower.includes("cdnjs.cloudflare.com") || lower.includes("cloudflareinsights")) services.push({ name: "Cloudflare CDN", category: "CDN" });
  if (lower.includes("fastly") || lower.includes("fastly.net")) services.push({ name: "Fastly", category: "CDN" });
  if (lower.includes("cloudfront.net")) services.push({ name: "AWS CloudFront", category: "CDN" });
  if (lower.includes("akamai") || lower.includes("akamaiedge")) services.push({ name: "Akamai", category: "CDN" });
  if (lower.includes("bunnycdn") || lower.includes("bcdn.com")) services.push({ name: "BunnyCDN", category: "CDN" });
  if (lower.includes("jsdelivr") || lower.includes("cdn.jsdelivr.net")) services.push({ name: "jsDelivr", category: "CDN" });
  if (lower.includes("unpkg.com")) services.push({ name: "unpkg", category: "CDN" });

  // Auth & Security
  if (lower.includes("auth0") || lower.includes("cdn.auth0.com")) services.push({ name: "Auth0", category: "Auth" });
  if (lower.includes("clerk") || lower.includes("clerk.dev")) services.push({ name: "Clerk", category: "Auth" });
  if (lower.includes("firebase") || lower.includes("firestore")) services.push({ name: "Firebase", category: "Auth" });
  if (lower.includes("supabase")) services.push({ name: "Supabase", category: "Auth" });
  if (lower.includes("hcaptcha")) services.push({ name: "hCaptcha", category: "Auth" });
  if (lower.includes("recaptcha") || lower.includes("google.com/recaptcha")) services.push({ name: "reCAPTCHA", category: "Auth" });

  return { tech: [...tech.entries()].map(([name, version]) => ({ name, version })), services };
}
