const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

const validId = (id) => /^[0-9a-f-]{20,}$/i.test(String(id || ""));

async function readConfig(kv, key) {
  if (!kv) return null;
  try { return await kv.get(key, "json"); } catch (_) { return null; }
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (id && !validId(id)) return new Response("Недостаје исправан идентификатор радионице.", { status: 400 });
  if (!env.SHARE_ASSETS) return new Response("Дељење није подешено: недостаје Cloudflare Workers KV binding SHARE_ASSETS.", { status: 503 });

  const useGlobalOnly = url.searchParams.get("use_global") === "1";
  const specific = id && !useGlobalOnly ? await readConfig(env.SHARE_ASSETS, `settings/workshops/${id}.json`) : null;
  const global = await readConfig(env.SHARE_ASSETS, "settings/global.json");
  const title = (url.searchParams.get("share_title") || specific?.title || global?.title || (id ? "Радионица — Отварамо прозоре" : "Отварамо прозоре — актуелне радионице")).slice(0, 180);
  const description = (url.searchParams.get("share_description") || specific?.description || global?.description || "Радионице за децу, родитеље и одрасле — упознајте програм и пријавите се.").slice(0, 500);
  const imageKey = specific?.imageKey || global?.imageKey || "";
  const version = Math.max(Number(specific?.updatedAt || 0), Number(global?.updatedAt || 0), Number(url.searchParams.get("v") || 0), 1);
  const imageUrl = imageKey
    ? `${url.origin}/share-image?key=${encodeURIComponent(imageKey)}&v=${version}`
    : `${url.origin}/og-cover.png?v=${version}`;
  const canonical = url.toString();
  const appUrl = id ? `${url.origin}/?radionica=${encodeURIComponent(id)}` : `${url.origin}/`;

  const html = `<!doctype html><html lang="sr-Cyrl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website"><meta property="og:locale" content="sr_RS"><meta property="og:site_name" content="Отварамо прозоре">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imageUrl)}"><meta property="og:image:secure_url" content="${esc(imageUrl)}"><meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(imageUrl)}">
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}"></head><body>
<p>${esc(title)}</p><p><a href="${esc(appUrl)}">Отвори актуелне радионице и пријави се</a></p>
<script>window.location.replace(${JSON.stringify(appUrl)});</script></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" }
  });
}
