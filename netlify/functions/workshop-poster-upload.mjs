const SUPABASE_URL = process.env.SUPABASE_URL || "https://cseghpzzvbbfophnoiyv.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_8C4zlGP8GUzsG7f2AuF3mw_yhvBfrJS";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "workshop-posters";

export default async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{20,}$/i.test(id)) return new Response("Неисправан идентификатор радионице.", { status: 400 });
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Потребна је пријава администратора.", { status: 401 });
  if (!SUPABASE_SERVICE_ROLE_KEY) return new Response("У Netlify-у недостаје SUPABASE_SERVICE_ROLE_KEY.", { status: 500 });
  try {
    // Провери да је bearer токен важећи Supabase кориснички токен.
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!authResponse.ok) return new Response("Пријава је истекла. Пријави се поново.", { status: 401 });
    const user = await authResponse.json();
    if (!user?.id) return new Response("Неважећа пријава.", { status: 401 });

    const workshopUrl = new URL(`${SUPABASE_URL}/rest/v1/public_workshops`);
    workshopUrl.searchParams.set("id", `eq.${id}`);
    workshopUrl.searchParams.set("select", "id");
    workshopUrl.searchParams.set("limit", "1");
    const workshopResponse = await fetch(workshopUrl, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!workshopResponse.ok) throw new Error("Није могуће проверити радионицу.");
    const workshops = await workshopResponse.json();
    if (!workshops.length) return new Response("Радионица није пронађена.", { status: 404 });

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/png")) return new Response("Потребна је PNG слика.", { status: 415 });
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return new Response("Слика је празна или већа од 8 MB.", { status: 413 });
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(id)}.png`;
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
        "Cache-Control": "public, max-age=300"
      },
      body: bytes
    });
    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text();
      console.error("Storage upload failed:", uploadResponse.status, detail);
      return new Response("Чување постера у Supabase Storage-у није успело.", { status: 502 });
    }
    return Response.json({ ok: true, path: `${id}.png` });
  } catch (error) {
    console.error("workshop-poster-upload error:", error);
    return new Response("Грешка приликом чувања постера.", { status: 500 });
  }
};
