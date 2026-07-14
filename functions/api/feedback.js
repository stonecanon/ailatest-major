const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const feedbackType = String(payload.feedback_type || "general").slice(0, 40);
  const message = String(payload.message || "").trim();
  const subject = String(payload.subject || "").trim().slice(0, 120);
  const contact = String(payload.contact || "").trim().slice(0, 120);
  const pageUrl = String(payload.page_url || "").trim().slice(0, 500);

  if (message.length < 5) {
    return json({ ok: false, error: "message_too_short" }, { status: 400 });
  }
  if (message.length > 2000) {
    return json({ ok: false, error: "message_too_long" }, { status: 400 });
  }

  const sourcePayload = JSON.stringify({
    user_agent: context.request.headers.get("user-agent") || "",
    referer: context.request.headers.get("referer") || "",
    submitted_at: new Date().toISOString()
  });

  if (!context.env.DB) {
    return json({
      ok: true,
      stored: false,
      reason: "D1 binding DB is not configured",
      feedback: { feedback_type: feedbackType, subject, page_url: pageUrl }
    }, { status: 202 });
  }

  await context.env.DB.prepare(
    `INSERT INTO user_feedback
      (page_url, feedback_type, subject, message, contact, source_payload, status)
     VALUES (?, ?, ?, ?, ?, ?, 'new')`
  )
    .bind(pageUrl, feedbackType, subject, message, contact, sourcePayload)
    .run();

  return json({ ok: true, stored: true });
}

export async function onRequestGet() {
  return json({ ok: true, endpoint: "feedback", methods: ["POST"] });
}
