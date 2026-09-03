import { NextRequest, NextResponse } from "next/server";
import { sessions } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = req.cookies.get("sso_session")?.value;
  if (sid) {
    sessions.delete(sid);
  }

  const { searchParams } = new URL(req.url);
  const redirectUri = searchParams.get("redirect_uri") || "";
  
  let res: NextResponse;
  
  if (
    redirectUri.startsWith("http://localhost:3001/") ||
    redirectUri.startsWith("http://localhost:4000/")
  ) {
    res = NextResponse.redirect(redirectUri, 303);
  } else {
    res = NextResponse.json({
      ok: true,
      message: "Demo IdP session cleared.",
    });
  }
  
  res.cookies.set("sso_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  
  return res;
}

export const POST = GET;