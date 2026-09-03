// demo-only in-memory storage, everything is lost on restart, never use in production
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export type AuthCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope: string;
  state: string;
  asurite: string;
  createdAt: number;
  used: boolean;
};

export type TokenRecord = {
  accessToken: string;
  asurite: string;
  clientId: string;
  scope: string;
  createdAt: number;
};

export type UserInfo = {
  sub: string;
  asurite: string;
  email: string;
  name: string;
  affiliation: string;
};

export const CODE_TTL_MS = 60_000;
export const TOKEN_TTL_S = 3600;

const g = globalThis as unknown as {
  __sso?: { codes: Map<string, AuthCode>; tokens: Map<string, TokenRecord>; sessions: Map<string, string> };
};
g.__sso ??= { codes: new Map(), tokens: new Map(), sessions: new Map() };
export const codes = g.__sso.codes;
export const tokens = g.__sso.tokens;
export const sessions = g.__sso.sessions; // sessionId -> asurite

export function randomId(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function base64UrlSha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier) return false;
  try {
    const verifierHash = createHash("sha256").update(codeVerifier).digest("base64url");
    const verifierBuffer = Buffer.from(verifierHash, "base64url");
    const challengeBuffer = Buffer.from(codeChallenge, "base64url");
    
    if (verifierBuffer.length !== challengeBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(verifierBuffer, challengeBuffer);
  } catch {
    return false;
  }
}

export function normalizeAsurite(raw: string): string {
  const trimmed = raw.trim();
  const asurite = trimmed.toLowerCase();
  const atIndex = asurite.lastIndexOf("@");
  return atIndex !== -1 ? asurite.substring(0, atIndex) : asurite;
}

export function makeUser(asurite: string): UserInfo {
  const normalized = normalizeAsurite(asurite);
  const name =
    normalized.charAt(0).toUpperCase() + normalized.slice(1) + " (demo user)";
  return {
    sub: "asu|" + normalized,
    asurite: normalized,
    email: normalized + "@asu.edu",
    name,
    affiliation: "student",
  };
}

export function sweep(): void {
  const now = Date.now();
  for (const [key, code] of codes.entries()) {
    if (now - code.createdAt > CODE_TTL_MS) {
      codes.delete(key);
    }
  }
  for (const [key, token] of tokens.entries()) {
    if (now - token.createdAt > TOKEN_TTL_S * 1000) {
      tokens.delete(key);
    }
  }
}

export function issueCode(input: Omit<AuthCode, "code" | "createdAt" | "used">): AuthCode {
  sweep();
  const code = randomId(24);
  const record: AuthCode = {
    ...input,
    code,
    createdAt: Date.now(),
    used: false,
  };
  codes.set(code, record);
  return record;
}

export function consumeCode(
  code: string,
  clientId: string,
  redirectUri: string
): { ok: true; record: AuthCode } | { ok: false; error: string } {
  const record = codes.get(code);
  if (!record) {
    return { ok: false, error: "invalid_grant" };
  }
  if (record.used) {
    return { ok: false, error: "invalid_grant" };
  }
  if (Date.now() - record.createdAt > CODE_TTL_MS) {
    codes.delete(code);
    return { ok: false, error: "invalid_grant" };
  }
  if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
    return { ok: false, error: "invalid_grant" };
  }
  record.used = true;
  return { ok: true, record };
}

export function issueToken(
  asurite: string,
  clientId: string,
  scope: string
): TokenRecord {
  sweep();
  const accessToken = randomId(32);
  const record: TokenRecord = {
    accessToken,
    asurite,
    clientId,
    scope,
    createdAt: Date.now(),
  };
  tokens.set(accessToken, record);
  return record;
}

export function getToken(accessToken: string): TokenRecord | null {
  const record = tokens.get(accessToken);
  if (!record) return null;
  if (Date.now() - record.createdAt > TOKEN_TTL_S * 1000) {
    tokens.delete(accessToken);
    return null;
  }
  return record;
}