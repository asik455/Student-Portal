const crypto = require("node:crypto");
const express = require("express");

const COOKIE_NAME = "complaint_desk_staff";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const sessions = new Map();
const loginAttempts = new Map();

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookieValue(request, name) {
  const header = request.headers.cookie;
  if (!header) return "";
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : "";
}

function sessionKey(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSession(email) {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(key);
  }
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionKey(token), { email, expiresAt: now + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const key = sessionKey(token);
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return session;
}

function deleteSession(token) {
  if (token) sessions.delete(sessionKey(token));
}

function requireStaff(request, response, next) {
  const token = getCookieValue(request, COOKIE_NAME);
  const session = getSession(token);
  if (!session) return response.status(401).json({ error: "Staff sign-in required." });
  request.staff = { email: session.email };
  next();
}

function attachStaff(request, response, next) {
  const session = getSession(getCookieValue(request, COOKIE_NAME));
  if (session) request.staff = { email: session.email };
  next();
}

function setSessionCookie(response, token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function isRateLimited(ip) {
  const now = Date.now();
  for (const [attemptIp, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(attemptIp);
  }
  const attempt = loginAttempts.get(ip);
  if (!attempt) return false;
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function createAuthRouter() {
  const router = express.Router();

  router.post("/login", (request, response) => {
    const ip = request.ip;
    if (isRateLimited(ip)) {
      return response.status(429).json({ error: "Too many sign-in attempts. Try again in 15 minutes." });
    }

    const configuredEmail = process.env.ADMIN_EMAIL;
    const configuredPassword = process.env.ADMIN_PASSWORD;
    if (!configuredEmail || !configuredPassword) {
      return response.status(503).json({ error: "Staff sign-in is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in Backend/.env." });
    }

    const { email, password } = request.body || {};
    if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) {
      recordFailedAttempt(ip);
      return response.status(401).json({ error: "Email or password is incorrect." });
    }

    const validEmail = safeEqual(email.trim().toLowerCase(), configuredEmail.trim().toLowerCase());
    const validPassword = safeEqual(password, configuredPassword);
    if (!validEmail || !validPassword) {
      recordFailedAttempt(ip);
      return response.status(401).json({ error: "Email or password is incorrect." });
    }

    loginAttempts.delete(ip);
    const token = createSession(configuredEmail.trim());
    setSessionCookie(response, token);
    response.json({ authenticated: true, email: configuredEmail.trim() });
  });

  router.get("/session", (request, response) => {
    const session = getSession(getCookieValue(request, COOKIE_NAME));
    if (!session) return response.json({ authenticated: false });
    response.json({ authenticated: true, email: session.email });
  });

  router.post("/logout", (request, response) => {
    deleteSession(getCookieValue(request, COOKIE_NAME));
    clearSessionCookie(response);
    response.json({ authenticated: false });
  });

  return router;
}

module.exports = {
  COOKIE_NAME,
  attachStaff,
  createAuthRouter,
  getSession,
  requireStaff
};
