import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { OAUTH_STATE_COOKIE, PKCE_VERIFIER_COOKIE, authorizeUrl, challengeFor, createVerifier } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET() {
  const verifier = createVerifier();
  const challenge = challengeFor(verifier);
  const state = randomBytes(16).toString("base64url");

  const res = NextResponse.redirect(authorizeUrl(state, challenge), 302);

  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" };
  res.cookies.set(PKCE_VERIFIER_COOKIE, verifier, opts);
  res.cookies.set(OAUTH_STATE_COOKIE, state, opts);

  return res;
}