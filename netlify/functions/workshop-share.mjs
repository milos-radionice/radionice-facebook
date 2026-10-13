
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://cseghpzzvbbfophnoiyv.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_8C4zlGP8GUzsG7f2AuF3mw_yhvBfrJS";

const SITE_URL = "https://licni-razvoj.netlify.app";

const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

const fmtDate = (value) => {
  if (!value) return "Термин у најави";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Термин у најави";
  return new Intl.DateTimeFormat("sr-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Belgrade"
  }).format(d);
};

async function getWorkshop(id) {
  const u = new URL(
    `${SUPABASE_URL}/rest/v1/public_workshops`
  );
  u.searchParams.set("id", `eq.${id}`);
  u.searchParams.set(
    "select",
    "id,title,short_description,event_date,location,price_rsd,image_url"
  );
  u.searchParams.set("limit", "1");

  const response = await fetch(u, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

export default async (request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  if (!/^[0-9a-f-]{20,}$/i.test(id)) {
    return new Response("Недостаје исправан идентификатор радионице.", {
      status: 400
    });
  }

  try {
    const w = await getWorkshop(id);

    if (!w) {
      return new Response("Радионица није пронађена.", {
        status: 404
      });
    }

    const title = w.title || "Радионица — Отварамо прозоре";
    const description = [
      w.short_description || "Практична радионица за учење, развој и нове идеје.",
      `Термин: ${fmtDate(w.event_date)}`,
      w.location || "",
      `Цена: ${Number(w.price_rsd || 0).toLocaleString("sr-RS")} РСД`
    ].filter(Boolean).join(" — ");

    const shareUrl =
      `${SITE_URL}/.netlify/functions/workshop-share?id=${encodeURIComponent(id)}`;

    const imageUrl =
      `${SITE_URL}/.netlify/functions/workshop-image?id=${encodeURIComponent(id)}`;

    const appUrl =
      `${SITE_URL}/?radionica=${encodeURIComponent(id)}`;

    const html = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(shareUrl)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Отварамо прозоре">
<meta property="og:url" content="${esc(shareUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">
</head>
<body>
<p>Отварамо прозоре — ${esc(title)}</p>
<p><a href="${esc(appUrl)}">Отвори радионицу и пријави се</a></p>
<script>
window.location.replace(${JSON.stringify(appUrl)});
</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("workshop-share error:", error);
    return new Response(
      "Тренутно није могуће припремити страницу за дељење.",
      { status: 500 }
    );
  }
};
