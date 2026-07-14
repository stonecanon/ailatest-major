export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });

export const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

export const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;

export const randomDigits = (length = 6) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => String(byte % 10)).join("");
};

export const randomToken = async () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

export const sha256 = async (value) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const codeHash = async (email, code, salt, env) =>
  sha256(`${salt}:${email}:${code}:${env.AUTH_SECRET || "majorai-email-login"}`);

export const sessionHash = async (token, env) =>
  sha256(`session:${token}:${env.AUTH_SECRET || "majorai-email-login"}`);

export const getClientIp = (request) =>
  request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";

export const parseSessionCookie = (request) => {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)majorai_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

export const sessionCookie = (token, maxAgeSeconds) =>
  `majorai_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;

export const expiredSessionCookie = () =>
  "majorai_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
