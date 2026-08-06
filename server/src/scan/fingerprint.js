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

  return [...tech.entries()].map(([name, version]) => ({ name, version }));
}
