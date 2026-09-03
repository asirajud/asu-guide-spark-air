import { NextRequest, NextResponse } from "next/server";
import { getToken, makeUser } from "@/lib/store";
import { getUser } from "@/lib/users";

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

  // Prefer the stored profile so name/email/affiliation are the real record,
  // falling back to the synthesised shape for any legacy token.
  const stored = getUser(rec.asurite);
  // Keep one subject format across both paths — `makeUser` prefixes with
  // "asu|", so anything keying on `sub` would otherwise see two principals for
  // the same student.
  const profile = stored
    ? { ...makeUser(rec.asurite), ...stored, sub: `asu|${rec.asurite}` }
    : makeUser(rec.asurite);

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export const POST = GET;