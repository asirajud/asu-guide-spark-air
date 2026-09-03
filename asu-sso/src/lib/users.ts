/**
 * Demo user store for the mock identity provider.
 *
 * Passwords are required and verified — this is no longer a "type anything"
 * login — but every account here is fictional and seeded locally. It is NOT
 * connected to ASU's directory and must never be pointed at real credentials.
 *
 * Hashing is scrypt with a per-user salt. Overkill for fake accounts, but
 * storing demo passwords in plaintext teaches the wrong thing to anyone reading
 * the repo.
 */
import Database from 'better-sqlite3'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'

const db = new Database(process.env.SSO_DB ?? join(process.cwd(), 'sso.db'))
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    asurite      TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    affiliation  TEXT NOT NULL DEFAULT 'Student',
    salt         TEXT NOT NULL,
    hash         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    last_login_at INTEGER
  );
`)

export type DemoUser = {
  asurite: string
  name: string
  email: string
  affiliation: string
}

/** Fixed salt used only to burn the same CPU on a miss as on a hit. */
const DUMMY_SALT = 'e3b0c44298fc1c149afbf4c8996fb924'

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

export function createUser(
  asurite: string,
  password: string,
  opts: Partial<Omit<DemoUser, 'asurite'>> = {},
): DemoUser {
  const salt = randomBytes(16).toString('hex')
  const user: DemoUser = {
    asurite,
    name: opts.name ?? asurite,
    email: opts.email ?? `${asurite}@asu.edu`,
    affiliation: opts.affiliation ?? 'Student',
  }

  db.prepare(
    `INSERT OR REPLACE INTO users (asurite, name, email, affiliation, salt, hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.asurite,
    user.name,
    user.email,
    user.affiliation,
    salt,
    hashPassword(password, salt),
    Date.now(),
  )

  return user
}

/** Constant-time password check. Returns null when the account or password is wrong. */
export function verifyUser(asurite: string, password: string): DemoUser | null {
  const row = db
    .prepare('SELECT * FROM users WHERE asurite = ?')
    .get(asurite.trim().toLowerCase()) as
    | {
        asurite: string
        name: string
        email: string
        affiliation: string
        salt: string
        hash: string
      }
    | undefined

  if (!password) return null

  // Hash against a dummy salt when the account does not exist, so an unknown
  // ASURITE costs the same as a known one. Without this, the login route's
  // single generic error message still leaks which accounts exist, by timing.
  if (!row) {
    hashPassword(password, DUMMY_SALT)
    return null
  }

  const expected = Buffer.from(row.hash, 'hex')
  const actual = Buffer.from(hashPassword(password, row.salt), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  db.prepare('UPDATE users SET last_login_at = ? WHERE asurite = ?').run(Date.now(), row.asurite)

  return {
    asurite: row.asurite,
    name: row.name,
    email: row.email,
    affiliation: row.affiliation,
  }
}

export function getUser(asurite: string): DemoUser | null {
  const row = db
    .prepare('SELECT asurite, name, email, affiliation FROM users WHERE asurite = ?')
    .get(asurite.trim().toLowerCase()) as DemoUser | undefined
  return row ?? null
}

export function listUsers(): DemoUser[] {
  return db
    .prepare('SELECT asurite, name, email, affiliation FROM users ORDER BY asurite')
    .all() as DemoUser[]
}

/** Fictional accounts, seeded once. `admin` / `admin` is the testing login. */
function seed() {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  if (count > 0) return

  createUser('admin', 'admin', { name: 'Demo Admin', affiliation: 'Staff' })
  createUser('asirajud', 'sparkdemo', { name: 'Azhar Sirajuddin', affiliation: 'Staff' })
  createUser('sundevil', 'sundevil', { name: 'Sunny Devil', affiliation: 'Student' })
}
seed()
