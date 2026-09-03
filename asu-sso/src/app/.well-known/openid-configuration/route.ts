import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const issuer = process.env.SSO_ISSUER ?? new URL(req.url).origin;
  
  const response = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/api/token`,
    userinfo_endpoint: `${issuer}/api/userinfo`,
    end_session_endpoint: `${issuer}/api/logout`,
    jwks_uri: null,
    scopes_supported: ["openid", "profile", "email"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["none"],
    claims_supported: ["sub", "asurite", "email", "name", "affiliation"],
    _demo_notice: "Mock identity provider for the ASU AIR Spark Challenge. Not affiliated with Arizona State University's real sign-in service. id_token is unsigned JSON, credentials in clients.json are fake, and no password is ever checked."
  };
  
  return new NextResponse(JSON.stringify(response), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}