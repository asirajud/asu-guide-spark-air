/**
 * Upper-cases the first letter of a reply.
 *
 * Belt and braces behind the prompt rule in #11: small models drift, and a
 * reply that opens lowercase reads like a bug. The guards matter more than the
 * transform — a reply that legitimately opens on a code token, a path, a flag
 * or an identifier must be left exactly as the model wrote it, because
 * `npm install` and `Npm install` are not the same string.
 */
export function capitaliseReply(text: string): string {
  const lead = /^\s*/.exec(text)![0]
  const rest = text.slice(lead.length)
  const first = rest[0]

  if (!first || first !== first.toLowerCase() || first === first.toUpperCase()) return text

  // Everything up to the first space is the word being judged.
  const word = rest.split(/\s/, 1)[0]
  // Backticked code, identifiers, paths, flags, URLs and versioned names are
  // all case-significant. So is anything the model already fenced.
  if (/[\d_./\\@`~:-]/.test(word)) return text

  return lead + first.toUpperCase() + rest.slice(1)
}
