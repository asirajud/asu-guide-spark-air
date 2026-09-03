# ASU SSO Demo

> ⚠️ **WARNING**: This is a demo/mock identity provider for the ASU AIR Spark Challenge. It is NOT a real ASU login system. It is not affiliated with, endorsed by, or connected to Arizona State University's real sign-in service. No password is ever checked, stored, logged, or transmitted. Do not enter a real ASURITE password into it or anything that looks like it.

## Safety Constraints

These are deliberate design rules that ensure this is clearly a demo:

- An always-visible amber warning banner sits at the top of the sign-in card and cannot be dismissed.
- Any ASURITE value is accepted. The password field is decorative — its value is never read by the server.
- No ASU logo, wordmark, Hotline banner, or any ASU imagery is reproduced. The header is plain text: "ASU Guide — Demo Sign In".
- The page `<title>` and the `<h1>` both contain the word "Demo".
- The dev server binds to `127.0.0.1` only (`next dev --port 4000 --hostname 127.0.0.1`).

## What is Actually Real

The OAuth 2.0 authorization-code flow with PKCE is genuine:
- `code_challenge_method=S256` is required
- The `code_verifier` is verified with a SHA-256 + constant-time comparison at the token endpoint
- Authorization codes are single-use and expire after 60 seconds
- `redirect_uri` must match a registered value exactly
- The client secret is checked

What is fake is the identity, not the protocol.

## Fake Credentials

The following client is registered in `clients.json`:

```json
{
  "client_id": "asu-guide-demo",
  "client_secret": "demo-secret-not-a-real-credential",
  "redirect_uri": "http://localhost:3001/api/auth/callback"
}
```

These are fabricated demo values committed deliberately so the handshake works out of the box. They are not real ASU credentials and never were.

## Running It

```bash
pnpm install
pnpm dev
```

The service will be available at http://localhost:4000

## Endpoints

| Method | Path                        | Purpose                                  |
|--------|-----------------------------|------------------------------------------|
| GET    | `/authorize`                | OAuth 2.0 authorization endpoint         |
| POST   | `/api/login`                | Demo login form submission               |
| POST   | `/api/token`                | OAuth 2.0 token endpoint                 |
| GET    | `/api/userinfo`             | User info endpoint                       |
| GET    | `/api/logout`               | Logout endpoint                          |
| GET    | `/.well-known/openid-configuration` | OpenID Connect configuration endpoint |

## Storage

Authorization codes, access tokens and IdP sessions live in plain in-memory `Map`s cached on `globalThis` (`src/lib/store.ts`). Restarting the server clears all of them. There is no database and nothing is persisted to disk.

## Known Limitations / Not Production-Grade

- The `id_token` is an unsigned plain JSON object, not a signed JWT (`jwks_uri` is null and `id_token_signing_alg_values_supported` is `["none"]`)
- There is no refresh token
- There is no user directory
- There is no rate limiting
- The client secret is in the repo

## Provenance

Every line of source in this project was written by ASU AIR open-weight models through the `opencode` CLI; see `AIR-BUILD-LOG.md`.