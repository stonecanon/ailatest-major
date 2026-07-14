import { expiredSessionCookie, json, parseSessionCookie, sessionHash } from "../../_auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: true, authenticated: false, reason: "auth_storage_not_configured" });
  }

  const token = parseSessionCookie(request);
  if (!token) {
    return json({ ok: true, authenticated: false });
  }

  const now = Date.now();
  const tokenHash = await sessionHash(token, env);
  const session = await env.DB
    .prepare(`SELECT email, expires_at_ms, created_at_ms FROM email_login_sessions
      WHERE session_hash = ? AND expires_at_ms > ?
      LIMIT 1`)
    .bind(tokenHash, now)
    .first();

  if (!session) {
    return json({ ok: true, authenticated: false }, {
      headers: { "set-cookie": expiredSessionCookie() }
    });
  }

  await env.DB
    .prepare("UPDATE email_login_sessions SET last_seen_at_ms = ? WHERE session_hash = ?")
    .bind(now, tokenHash)
    .run();

  return json({
    ok: true,
    authenticated: true,
    email: session.email,
    profile: {
      email: session.email,
      login_method: "email",
      session_created_at: new Date(Number(session.created_at_ms)).toISOString()
    }
  });
}

export async function onRequestPost(context) {
  return onRequestGet(context);
}
