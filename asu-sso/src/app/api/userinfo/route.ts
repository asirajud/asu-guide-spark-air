import { NextRequest, NextResponse } from "next/server";
import { getToken, makeUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "invalid_token", error_description: "Missing Bearer token." },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": "Bearer",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const rec = getToken(token);
  if (!rec) {
    return NextResponse.json(
      { error: "invalid_token", error_description: "Token is unknown or expired." },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": "Bearer",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.json(makeUser(rec.asurite), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export const POST = GET;