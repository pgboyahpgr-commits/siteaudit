export function fingerprintFromPage(page) {
  const tech = new Map();
  const headers = page.headers || {};
  const html = (page.html || "").toLowerCase();
  const server = headers["server"];
  const powered = headers["x-powered-by"];

  if (server) {
    if (/nginx/i.test(server)) tech.set("Nginx", server.match(/\d+(\.\d+)+/)?.[0]);
    else if (/apache/i.test(server)) tech.set("Apache", server.match(/\d+(\.\d+)+/)?.[0]);
    else if (/cloudflare/i.test(server)) tech.set("Cloudflare", null);
    else if (/vercel/i.test(server)) tech.set("Vercel", null);
    else if (/netlify/i.test(server)) tech.set("Netlify", null);
    else tech.set("Web server: " + server, null);
  }
  if (powered) tech.set("Powered by: " + powered, null);

  if (page.generator) tech.set(page.generator, null);

  if (html.includes("wp-content") || html.includes("wp-includes")) tech.set("WordPress", null);
  if (html.includes("id=\"root\"") || html.includes("data-reactroot")) tech.set("React", null);
  if (html.includes("ng-version") || html.includes("ng-app")) tech.set("Angular", null);
  if (html.includes("vue")) tech.set("Vue.js", null);
  if (html.includes("shopify")) tech.set("Shopify", null);
  if (html.includes("drupal")) tech.set("Drupal", null);
  if (html.includes("joomla")) tech.set("Joomla", null);
  if (html.includes("bootstrap")) tech.set("Bootstrap", null);
  if (html.includes("tailwind")) tech.set("Tailwind CSS", null);
  if (html.includes("jquery")) tech.set("jQuery", null);
  if (html.includes("next-data")) tech.set("Next.js", null);
  if (html.includes("gatsby")) tech.set("Gatsby", null);
  if (html.includes("svelte")) tech.set("Svelte", null);
  if (html.includes("astro")) tech.set("Astro", null);
  if (html.includes("php")) tech.set("PHP", null);
  if (html.includes("asp.net")) tech.set("ASP.NET", null);
  if (html.includes("laravel")) tech.set("Laravel", null);
  if (html.includes("django")) tech.set("Django", null);
  if (html.includes("flask")) tech.set("Flask", null);
  if (html.includes("express")) tech.set("Express", null);

  return [...tech.entries()].map(([name, version]) => ({ name, version }));
}
