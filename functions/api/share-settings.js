const SUPABASE_URL = "https://cseghpzzvbbfophnoiyv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8C4zlGP8GUzsG7f2AuF3mw_yhvBfrJS";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function configKey(scope, id) {
  return scope === "global"
    ? "settings/global.json"
    : `settings/workshops/${id}.json`;
}

function validId(id) {
  return /^[0-9a-f-]{20,}$/i.test(String(id || ""));
}

async function readConfig(kv, key) {
  try {
    return await kv.get(key, "json");
  } catch (_) {
    return null;
  }
}

async function requireAdmin(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw Object.assign(
      new Error("Пријави се као администратор."),
      { status: 401 }
    );
  }

  const token = match[1];

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!userResponse.ok) {
    throw Object.assign(
      new Error("Администраторска сесија је истекла. Пријави се поново."),
      { status: 401 }
    );
  }

  const user = await userResponse.json();

  if (!user?.id) {
    throw Object.assign(
      new Error("Није потврђен кориснички налог."),
      { status: 401 }
    );
  }

  const adminResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/app_admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!adminResponse.ok) {
    throw Object.assign(
      new Error("Није могуће проверити администраторска овлашћења."),
      { status: 403 }
    );
  }

  const rows = await adminResponse.json();

  if (!Array.isArray(rows) || !rows.some(row => row.user_id === user.id)) {
    throw Object.assign(
      new Error("Само овлашћени администратор може да мења Facebook подешавања."),
      { status: 403 }
    );
  }

  return user;
}

export async function onRequest({ request, env }) {
  if (!env.SHARE_ASSETS) {
    return json({
      error: "Cloudflare Workers KV binding SHARE_ASSETS није подешен."
    }, 503);
  }

  const url = new URL(request.url);

  if (request.method === "GET") {
    const scope =
      url.searchParams.get("scope") === "global"
        ? "global"
        : "workshop";

    const id = url.searchParams.get("id") || "";

    if (scope === "workshop" && !validId(id)) {
      return json({
        error: "Недостаје исправан идентификатор радионице."
      }, 400);
    }

    const config = await readConfig(
      env.SHARE_ASSETS,
      configKey(scope, id)
    );

    return json({ config });
  }

  if (request.method !== "POST") {
    return json({ error: "Метод није подржан." }, 405);
  }

  try {
    await requireAdmin(request);

    const form = await request.formData();
    const scope =
      form.get("scope") === "global" ? "global" : "workshop";

    const id = String(form.get("id") || "");

    if (scope === "workshop" && !validId(id)) {
      return json({
        error: "Недостаје исправан идентификатор радионице."
      }, 400);
    }

    const title = String(form.get("title") || "").trim().slice(0, 180);
    const description = String(form.get("description") || "").trim().slice(0, 500);
    const key = configKey(scope, id);
    const previous = await readConfig(env.SHARE_ASSETS, key) || {};

    const image = form.get("image");
    let imageKey = previous.imageKey || "";
    let imageType = previous.imageType || "";

    if (image && typeof image.arrayBuffer === "function" && image.size > 0) {
      const allowed = new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
      ]);

      if (!allowed.has(image.type)) {
        return json({ error: "Изабери JPG, PNG или WebP слику." }, 415);
      }

      if (image.size > 3 * 1024 * 1024) {
        return json({ error: "Слика мора бити мања од 3 MB." }, 413);
      }

      imageKey =
        scope === "global"
          ? "covers/global"
          : `covers/workshop-${id}`;

      imageType = image.type;

      await env.SHARE_ASSETS.put(
        imageKey,
        await image.arrayBuffer()
      );
    }

    const config = {
      scope,
      ...(scope === "workshop" ? { id } : {}),
      title,
      description,
      imageKey,
      imageType,
      updatedAt: Date.now()
    };

    await env.SHARE_ASSETS.put(key, JSON.stringify(config));

    return json({ config });
  } catch (error) {
    return json({
      error: error?.message || "Дошло је до грешке при чувању подешавања."
    }, error?.status || 500);
  }
}
