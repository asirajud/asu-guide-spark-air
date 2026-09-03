import { NextRequest, NextResponse } from "next/server";
import { APP_URL, OAUTH_STATE_COOKIE, PKCE_VERIFIER_COOKIE, exchangeCode, fetchUserInfo } from "@/lib/sso";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fail = (reason: string) => {
    console.error("[auth/callback]", reason);
    const home = new URL("/", APP_URL);
    home.searchParams.set("sso_error", "1");
    const res = NextResponse.redirect(home.toString(), 302);
    res.cookies.set(PKCE_VERIFIER_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return fail("idp returned error: " + error);
  }

  if (!code) {
    return fail("missing code");
  }

  const verifier = req.cookies.get(PKCE_VERIFIER_COOKIE)?.value;
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!verifier) {
    return fail("missing pkce verifier cookie");
  }

  if (!expectedState || !state || state !== expectedState) {
    return fail("state mismatch");
  }

  try {
    const token = await exchangeCode(code, verifier);
    const user = await fetchUserInfo(token.access_token);
    const res = NextResponse.redirect(new URL("/", APP_URL).toString(), 302);
    res.cookies.set(SESSION_COOKIE, signSession(user), SESSION_COOKIE_OPTIONS);
    res.cookies.set(PKCE_VERIFIER_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    return fail(String(err));
  }
}