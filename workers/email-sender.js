const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const secret = request.headers.get("x-majorai-email-secret") || "";
    if (!env.EMAIL_WORKER_SECRET || secret !== env.EMAIL_WORKER_SECRET) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!env.EMAIL?.send) {
      return json({ ok: false, error: "email_binding_not_configured" }, { status: 503 });
    }

    const payload = await readJson(request);
    const to = String(payload.to || "").trim();
    const subject = String(payload.subject || "").trim();
    const html = String(payload.html || "");
    const text = String(payload.text || "");

    if (!to || !subject || (!html && !text)) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    try {
      const result = await env.EMAIL.send({
        to,
        from: env.AUTH_EMAIL_FROM || "login@ailatest.org",
        subject,
        html,
        text
      });
      return json({ ok: true, result });
    } catch (error) {
      return json({
        ok: false,
        error: String(error.code || "email_send_failed"),
        message: String(error.message || "")
      }, { status: 502 });
    }
  }
};
