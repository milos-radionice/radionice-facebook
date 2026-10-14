function errorResponse(message, status) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function onRequestGet({ request, env }) {
  if (!env.SHARE_ASSETS) return errorResponse("Cloudflare Workers KV binding SHARE_ASSETS није подешен.", 503);
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  let configKey = "";
  if (key === "covers/global") {
    configKey = "settings/global.json";
  } else {
    const match = key.match(/^covers\/workshop-([0-9a-f-]{20,})$/i);
    if (!match) return errorResponse("Слика није пронађена.", 400);
    configKey = `settings/workshops/${match[1]}.json`;
  }

  try {
    const config = await env.SHARE_ASSETS.get(configKey, "json");
    if (!config || config.imageKey !== key) return errorResponse("Слика није пронађена.", 404);
    const image = await env.SHARE_ASSETS.get(key, "arrayBuffer");
    if (!image) return errorResponse("Слика није пронађена.", 404);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const contentType = allowedTypes.has(config.imageType) ? config.imageType : "image/png";
    return new Response(image, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (_) {
    return errorResponse("Не могу да прочитам слику. Покушај поново за минут.", 503);
  }
}
