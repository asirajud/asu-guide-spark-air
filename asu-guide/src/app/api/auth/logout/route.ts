import { NextResponse } from "next/server";
import { APP_URL, SSO_ISSUER } from "@/lib/sso";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = new URL("/api/logout", SSO_ISSUER);
  url.searchParams.set("redirect_uri", APP_URL + "/");

  const res = NextResponse.redirect(url.toString(), 302);

  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });

  return res;
}

export const POST = GET;