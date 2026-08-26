import { jwtVerify, SignJWT } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import * as db from "../db";

export const LOCAL_SESSION_COOKIE = "faro_device_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function sessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  return new TextEncoder().encode(secret);
}

function secureCookie(req: Request) {
  return req.protocol === "https" || req.headers["x-forwarded-proto"] === "https";
}

export async function issueLocalSession(res: Response, req: Request, userId: number) {
  const token = await new SignJWT({ scope: "faro-device" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer("faro-ai")
    .setAudience("faro-client")
    .sign(sessionKey());

  res.cookie(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookie(req),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearLocalSession(res: Response, req: Request) {
  res.clearCookie(LOCAL_SESSION_COOKIE, {
    httpOnly: true,
    secure: secureCookie(req),
    sameSite: "lax",
    path: "/",
  });
}

export async function authenticateLocalSession(req: Request) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { issuer: "faro-ai", audience: "faro-client" });
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) return null;
    return (await db.getUserById(userId)) ?? null;
  } catch {
    return null;
  }
}
