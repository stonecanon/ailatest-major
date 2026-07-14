import { codeHash, getClientIp, isValidEmail, json, normalizeEmail, randomDigits, sha256 } from "../../_auth.js";

const TEN_MINUTES = 10 * 60 * 1000;

const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const countRecent = async (db, field, value, since) => {
  const row = await db
    .prepare(`SELECT COUNT(*) AS count FROM email_login_codes WHERE ${field} = ? AND created_at_ms > ?`)
    .bind(value, since)
    .first();
  return Number(row?.count || 0);
};

const sendEmail = async (env, message) => {
  if (env.EMAIL_WORKER_URL && env.EMAIL_WORKER_SECRET) {
    const response = await fetch(env.EMAIL_WORKER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-majorai-email-secret": env.EMAIL_WORKER_SECRET
      },
      body: JSON.stringify({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      const error = new Error(result.message || result.error || "email_worker_failed");
      error.code = result.error || response.status;
      throw error;
    }
    return result;
  }

  if (env.EMAIL?.send) {
    return env.EMAIL.send(message);
  }

  if (!env.CLOUDFLARE_EMAIL_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
    const error = new Error("email_not_configured");
    error.code = "email_not_configured";
    throw error;
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_EMAIL_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      to: message.to,
      from: typeof message.from === "string" ? message.from : message.from.email,
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.errors?.[0]?.message || "email_send_failed");
    error.code = result.errors?.[0]?.code || response.status;
    throw error;
  }
  return result;
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const payload = await readJson(request);
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    return json({ ok: false, error: "invalid_email", message: "请输入有效的邮箱地址。" }, { status: 400 });
  }

  if (!env.DB) {
    return json({ ok: false, error: "auth_storage_not_configured", message: "登录数据库暂未配置。" }, { status: 503 });
  }

  if (!env.EMAIL_WORKER_URL && !env.EMAIL?.send && (!env.CLOUDFLARE_EMAIL_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID)) {
    return json({
      ok: false,
      error: "email_not_configured",
      message: "邮箱验证码服务正在配置中。"
    }, { status: 503 });
  }

  const now = Date.now();
  const ipHash = await sha256(`ip:${getClientIp(request)}:${env.AUTH_SECRET || "majorai-email-login"}`);
  const recentEmailCount = await countRecent(env.DB, "email", email, now - TEN_MINUTES);
  const recentIpCount = await countRecent(env.DB, "ip_hash", ipHash, now - TEN_MINUTES);

  if (recentEmailCount >= 3 || recentIpCount >= 20) {
    return json({ ok: false, error: "rate_limited", message: "验证码发送太频繁，请稍后再试。" }, { status: 429 });
  }

  const code = randomDigits(6);
  const salt = crypto.randomUUID();
  const hash = await codeHash(email, code, salt, env);
  const userAgent = String(request.headers.get("user-agent") || "").slice(0, 240);

  await env.DB
    .prepare(`INSERT INTO email_login_codes (email, code_hash, salt, expires_at_ms, ip_hash, user_agent, created_at_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(email, hash, salt, now + TEN_MINUTES, ipHash, userAgent, now)
    .run();

  const fromEmail = env.AUTH_EMAIL_FROM || "login@ailatest.org";
  const fromName = env.AUTH_EMAIL_FROM_NAME || "majorAI";
  const subject = "majorAI 登录验证码";
  const text = `你的 majorAI 登录验证码是 ${code}，10 分钟内有效。若不是你本人操作，可以忽略这封邮件。`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.7;color:#14213d">
    <h2 style="margin:0 0 12px">majorAI 登录验证码</h2>
    <p>你的验证码是：</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:4px;margin:12px 0">${code}</p>
    <p>验证码 10 分钟内有效。若不是你本人操作，可以忽略这封邮件。</p>
  </div>`;

  try {
    await sendEmail(env, {
      to: email,
      from: { email: fromEmail, name: fromName },
      subject,
      text,
      html
    });
  } catch (error) {
    return json({
      ok: false,
      error: String(error.code || "email_send_failed"),
      message: "验证码邮件发送失败，请稍后再试。"
    }, { status: error.code === "email_not_configured" ? 503 : 502 });
  }

  return json({ ok: true, sent: true, email, expires_in: 600 });
}

export async function onRequestGet() {
  return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
