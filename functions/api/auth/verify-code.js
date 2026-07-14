import {
  codeHash,
  isValidEmail,
  json,
  normalizeEmail,
  randomToken,
  sessionCookie,
  sessionHash
} from "../../_auth.js";

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const payload = await readJson(request);
  const email = normalizeEmail(payload.email);
  const code = String(payload.code || "").trim();

  if (!isValidEmail(email)) {
    return json({ ok: false, error: "invalid_email", message: "请输入有效的邮箱地址。" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return json({ ok: false, error: "invalid_code_format", message: "请输入 6 位数字验证码。" }, { status: 400 });
  }

  if (!env.DB) {
    return json({ ok: false, error: "auth_storage_not_configured", message: "登录数据库暂未配置。" }, { status: 503 });
  }

  const now = Date.now();
  const row = await env.DB
    .prepare(`SELECT id, code_hash, salt, attempts FROM email_login_codes
      WHERE email = ? AND consumed_at_ms IS NULL AND expires_at_ms > ?
      ORDER BY created_at_ms DESC LIMIT 1`)
    .bind(email, now)
    .first();

  if (!row) {
    return json({ ok: false, error: "code_expired", message: "验证码不存在或已过期，请重新获取。" }, { status: 400 });
  }

  if (Number(row.attempts || 0) >= 5) {
    return json({ ok: false, error: "too_many_attempts", message: "验证码尝试次数过多，请重新获取。" }, { status: 429 });
  }

  const hash = await codeHash(email, code, row.salt, env);
  if (hash !== row.code_hash) {
    await env.DB
      .prepare("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = ?")
      .bind(row.id)
      .run();
    return json({ ok: false, error: "invalid_code", message: "验证码不正确。" }, { status: 400 });
  }

  await env.DB
    .prepare("UPDATE email_login_codes SET consumed_at_ms = ? WHERE id = ?")
    .bind(now, row.id)
    .run();

  await env.DB
    .prepare(`INSERT INTO email_users (email, created_at_ms, last_login_at_ms)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET last_login_at_ms = excluded.last_login_at_ms`)
    .bind(email, now, now)
    .run();

  const token = await randomToken();
  const tokenHash = await sessionHash(token, env);
  const days = Math.max(1, Math.min(90, Number(env.AUTH_SESSION_DAYS || 30)));
  const maxAgeSeconds = days * 24 * 60 * 60;

  await env.DB
    .prepare(`INSERT INTO email_login_sessions (email, session_hash, expires_at_ms, created_at_ms, last_seen_at_ms)
      VALUES (?, ?, ?, ?, ?)`)
    .bind(email, tokenHash, now + maxAgeSeconds * 1000, now, now)
    .run();

  return json({
    ok: true,
    email,
    profile: {
      email,
      login_method: "email",
      email_verified_at: new Date(now).toISOString()
    }
  }, {
    headers: {
      "set-cookie": sessionCookie(token, maxAgeSeconds)
    }
  });
}

export async function onRequestGet() {
  return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
