import { expiredSessionCookie, json, parseSessionCookie, sessionHash } from "../../_auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = parseSessionCookie(request);

  if (token && env.DB) {
    const tokenHash = await sessionHash(token, env);
    await env.DB
      .prepare("DELETE FROM email_login_sessions WHERE session_hash = ?")
      .bind(tokenHash)
      .run();
  }

  return json({ ok: true }, {
    headers: { "set-cookie": expiredSessionCookie() }
  });
}

export async function onRequestGet(context) {
  return onRequestPost(context);
}
