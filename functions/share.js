
const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  if (!/^[0-9a-f-]{20,}$/i.test(id)) {
    return new Response("Недостаје исправан идентификатор радионице.", { status: 400 });
  }

  const title = (url.searchParams.get("share_title") || "Радионица — Отварамо прозоре").slice(0, 180);
  const description = (url.searchParams.get("share_description") || "Радионице за децу, родитеље и одрасле — упознајте програм и пријавите се.").slice(0, 500);
  const candidate = url.searchParams.get("share_image") || "";
  let imageUrl = `${url.origin}/og-cover.png`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      imageUrl = parsed.toString();
    }
  } catch (_) {}

  const canonical = url.toString();
  const appUrl = `${url.origin}/?radionica=${encodeURIComponent(id)}`;

  const html = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Отварамо прозоре">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:secure_url" content="${esc(imageUrl)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}">
</head>
<body>
<p>Отварамо прозоре — ${esc(title)}</p>
<p><a href="${esc(appUrl)}">Отвори радионицу и пријави се</a></p>
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
