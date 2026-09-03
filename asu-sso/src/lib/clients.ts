// server-only: reads from disk
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const clientsJson = JSON.parse(
  readFileSync(join(process.cwd(), 'clients.json'), 'utf-8')
);

export type OAuthClient = {
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
  scopes: string[];
};

const clients: OAuthClient[] = clientsJson.clients;

export function getClient(clientId: string): OAuthClient | null {
  return clients.find((client) => client.client_id === clientId) || null;
}

export function isValidRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirect_uris.includes(redirectUri);
}

export function checkClientSecret(client: OAuthClient, secret: string): boolean {
  // Guard against unequal lengths
  if (client.client_secret.length !== secret.length) {
    return false;
  }
  
  // Constant-time comparison
  const secretBuffer = Buffer.from(secret);
  const clientSecretBuffer = Buffer.from(client.client_secret);
  
  try {
    return timingSafeEqual(secretBuffer, clientSecretBuffer);
  } catch {
    // If timingSafeEqual fails, fall back to a safe comparison
    return secret === client.client_secret;
  }
}

/**
 * Origins any registered client is allowed to be sent back to.
 *
 * Post-logout redirects are validated against this rather than a hardcoded port
 * list, so moving an app between ports cannot silently strand the user on a
 * JSON page — and an unregistered origin still cannot be used as an open
 * redirect.
 */
export function isAllowedRedirectOrigin(redirectUri: string): boolean {
  let origin: string;
  try {
    origin = new URL(redirectUri).origin;
  } catch {
    return false;
  }

  return clientsJson.clients.some((c: OAuthClient) =>
    c.redirect_uris.some((u) => {
      try {
        return new URL(u).origin === origin;
      } catch {
        return false;
      }
    }),
  );
}
