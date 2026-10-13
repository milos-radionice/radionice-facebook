const SUPABASE_URL = process.env.SUPABASE_URL || "https://cseghpzzvbbfophnoiyv.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_8C4zlGP8GUzsG7f2AuF3mw_yhvBfrJS";

async function getWorkshopImage(id) {
  const u = new URL(`${SUPABASE_URL}/rest/v1/public_workshops`);
  u.searchParams.set("id", `eq.${id}`);
  u.searchParams.set("select", "image_url");
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
  return rows[0]?.image_url || "";
}

export default async (request) => {
  const id = new URL(request.url).searchParams.get("id") || "";

  if (!/^[0-9a-f-]{20,}$/i.test(id)) {
    return new Response("Invalid workshop", { status: 400 });
  }

  try {
    // Prvo pokušavamo da učitamo sačuvani poster.
    const posterUrl =
      `${SUPABASE_URL}/storage/v1/object/public/workshop-posters/${id}.png`;

    const poster = await fetch(posterUrl, { redirect: "follow" });

    if (poster.ok) {
      return new Response(poster.body, {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=300"
        }
      });
    }

    // Ako poster nije sačuvan, koristimo originalnu sliku radionice.
    const image = await getWorkshopImage(id);

    if (!image) {
      return new Response("No image", { status: 404 });
    }

    if (image.startsWith("data:")) {
      const match = image.match(
        /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/i
      );

      if (!match) {
        return new Response("Unsupported image data", { status: 415 });
      }

      const mime = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
      const bytes = Buffer.from(match[2], "base64");

      return new Response(bytes, {
        headers: {
          "content-type": mime,
          "content-length": String(bytes.length),
          "cache-control": "public, max-age=300"
        }
      });
    }

    const remote = await fetch(image, { redirect: "follow" });

    if (!remote.ok) {
      return new Response("Image unavailable", { status: 502 });
    }

    const type = remote.headers.get("content-type") || "image/jpeg";

    if (!type.startsWith("image/")) {
      return new Response("Invalid image type", { status: 415 });
    }

    return new Response(remote.body, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=300"
      }
    });
  } catch (error) {
    console.error("workshop-image error", error);
    return new Response("Image unavailable", { status: 500 });
  }
};
