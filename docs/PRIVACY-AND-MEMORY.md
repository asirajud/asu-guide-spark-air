# Privacy and Memory - Design Review and Architecture Proposal

This document was drafted and reviewed by ASU AIR open-weight models.

## 1. The core tension
The system must never transmit raw user utterances or client-side profile state to the server. Principle: **profile construction and storage are strictly client-side; the server only receives transient, de-identified, single-turn payloads for inference.** This forbids sending full chat histories, voice input, or structured user profiles over the network. It permits sending redacted, anonymized text fragments for entity extraction, provided no session identifier or user key is attached.

## 2. Storage options

| Option | Where the profile lives | FERPA exposure | Device loss | Multi-device | Failure modes |
|--------|-------------------------|----------------|-------------|--------------|---------------|
| (a) On-device only | Browser (IndexedDB / OPFS) | None (data never leaves device) | Permanent loss if device fails or is reset | Not supported | Safari storage eviction (7-day), quota limits, no sync |
| (b) Server-side per-user rows | SQLite DB, keyed by ASURITE | High (creates a persistent, identifiable record of inferred interests) | No loss | Full support | FERPA violation risk, requires strict access controls, audit trails |
| (c) Hybrid (client-encrypted) | Encrypted blob in SQLite, key derived client-side | None (server cannot decrypt) | Permanent if key is lost | Supported if key is synced (e.g. via iCloud Keychain) | Key management complexity, sync conflicts, client-side decryption overhead |

On-device storage avoids FERPA exposure but fails under device loss and Safari's aggressive eviction. Server-side rows enable sync but create FERPA-relevant records linking inferred interests to an ASURITE—crossing the regulatory line. The hybrid model stores only ciphertext on the server, so breaches expose nothing. Key loss still means profile loss, and cross-device sync depends on platform key management.

**Recommendation**: Use on-device storage (a) for the hackathon build. This costs no multi-device support and vulnerability to Safari's eviction, but is acceptable for a demo where users interact on a single device. The profile is per-device by design; a second device starts from an empty graph, and that is a real product cost, not a detail.

## 3. The on-device knowledge graph

**Entity table**

| Entity type | Example | Where it comes from |
|-------------|---------|---------------------|
| Person | the user | ASURITE from OAuth, local ID only |
| Interest | robotics, live music | onboarding selection, chat extraction |
| Org/Club | ASU AI Society | chat extraction, event metadata |
| Event | hackathon, lecture | event catalog, chat mentions |
| Place | Polytechnic Hall, Tempe campus | chat extraction, event location |
| Course | CSE 466 | chat extraction |
| Contact | "Sarah from robotics club" | chat extraction, stored as alias only |
| TimePreference | weekday evenings | onboarding, chat extraction |
| Modality | in-person | chat extraction |
| Constraint | wheelchair access, $5 max | chat extraction |

**Typed-edge table**

| Edge | From -> To | Example |
|------|------------|---------|
| INTERESTED_IN | Person -> Interest | user -> robotics |
| ATTENDED | Person -> Event | user -> hackathon |
| DECLINED | Person -> Event | user -> lecture |
| MEMBER_OF | Person -> Org/Club | user -> AI Society |
| LOCATED_AT | Event -> Place | hackathon -> Polytechnic Hall |
| ENROLLED_IN | Person -> Course | user -> CSE 466 |
| KNOWS | Person -> Contact | user -> "Sarah from robotics club" |
| PREFERS_TIME | Person -> TimePreference | user -> weekday evenings |
| AVOIDS | Person -> Event/Place | user -> downtown campus |
| CO_ATTENDS_WITH | Person -> Contact | user -> "Sarah from robotics club" |

Every edge carries: `confidence` (0-1), `provenance` (conversation_id + turn_index), `first_seen`, `last_seen`, `evidence_count`, and `source` enum (`stated` | `inferred` | `observed`).

**Decay rule**

Inferred edges decay: `confidence = confidence * 0.95` per 30 days without re-observation. Stated edges do not decay.

### Query engine

Two SQLite tables (WASM): `nodes(id, type, label, attrs_json)` and `edges(src, dst, type, confidence, provenance_json, first_seen, last_seen, source)`. Queries are bounded 1-2 hop traversals scored by `confidence * recency`, expressed as ordinary SQL joins. Traversals are capped at 2 hops to hold local query latency under 100 ms.

Example: "events this week matching my top interests, at times I prefer, near places I go":

```sql
SELECT e.label,
       ei.confidence * (0.1 + 0.9 * (julianday('now') - julianday(ei.last_seen)) / 365.0) as score
FROM nodes e
JOIN edges ei ON ei.src = :user_id AND ei.type = 'INTERESTED_IN'
JOIN nodes i ON i.id = ei.dst
JOIN json_each(e.attrs_json, '$.tags') AS tags ON tags.value = i.label
WHERE e.type = 'Event'
  AND e.attrs_json->>'date' >= date('now')
  AND EXISTS (
    SELECT 1
    FROM edges el
    JOIN nodes p ON p.id = el.dst
    WHERE el.src = e.id AND el.type = 'LOCATED_AT'
      AND (
        EXISTS (SELECT 1 FROM edges pa WHERE pa.src = :user_id AND pa.dst = p.id AND pa.type IN ('INTERESTED_IN', 'ATTENDED'))
        OR p.label = 'Tempe campus'
      )
  )
  AND EXISTS (
    SELECT 1
    FROM edges tp
    JOIN nodes tpref ON tpref.id = tp.dst
    WHERE tp.src = :user_id AND tp.type = 'PREFERS_TIME'
      AND tpref.label = e.attrs_json->>'$.time_of_day'
  )
GROUP BY e.id
ORDER BY score DESC
LIMIT 5;
```

This query uses indexes on `edges(src, type)` and `edges(dst, type)` for performance.

### Seeding and growth

Core KG seeded at first run: ASURITE -> Person node, plus 3-4 opt-in onboarding taps. Cold-start graph: ~10 nodes, ~5 edges. Grows incrementally: one extraction per conversation turn, new edges arrive at `confidence=0.3`, promoted only after repeat evidence (`evidence_count >= 2`) or explicit user confirmation.

## 4. The extraction loop and its privacy hole

Today, the following leaves the device: raw utterance text, ASURITE (via session cookie), timestamps, and IP address. The ASURITE and raw text are primary risks—linking identifiable user data with personal interests.

Mitigation: implement a client-side redaction pass before any server call. Strip names, ASURITE patterns, room numbers, course codes. Generalize phrases like "my roommate Priya" to "a person the user knows" or "PHYS 101" to "a science course". Send only the current turn, with no session cookie or user identifier. Use a stateless endpoint so no linkage across turns is possible.

Local extraction using a small model (e.g., transformers.js with distilled BERT) is technically feasible but not measured—this is a sketch; page-weight and accuracy cost exclude it from the demo.

**User disclosure**: "To improve recommendations, we analyze your messages. Message text—stripped of names and identifiers—is sent to ASU's own inference cluster to work out what to remember, one message at a time, with nothing linking messages to you. Your full conversation history and your profile stay on your device. If memory is off, nothing is extracted at all."

## 5. Context loading for a daily brief

A compact "context pack" is assembled at query time from the local graph and injected into the prompt. The entire graph is never shipped.

**Hard budget**: target under 400 tokens, at most ~15 facts.

**Selection rule**: top-N edges by `confidence * recency_decay`, filtered to entity types the current query actually needs. An events query needs Interest, TimePreference, Place, Constraint — not Course or Contact.

**Rendered shape**: de-identified bullet list, no names, no ASURITE:
```
likes: robotics, live music
prefers: weekday evenings
campus: Tempe
constraints: wheelchair access, $5 max
```

The pack is rebuilt per request and never cached server-side.

| Query type | Entity types included | Approx budget |
|------------|----------------------|---------------|
| Events | Interest, TimePreference, Place, Constraint | 120 tokens |
| Courses | Interest, Course, Place | 100 tokens |
| People | Contact, Org/Club, Interest | 80 tokens |
| General | Interest, Place, Modality | 60 tokens |

A pack this small will sometimes omit a relevant preference, which is the correct failure direction - missing a preference is less harmful than leaking one.

## 6. User control

Four controls, each with explicit storage-layer behavior.

**Inspection**: A "What I think I know about you" screen enumerates every node and edge, displaying the plain-language statement, confidence score, extraction timestamp, and originating conversation ID by reading directly from the wasm-SQLite graph and provenance table.

**Per-fact correction and deletion**: Deleting an edge removes the record and provenance row, purges cached embeddings, and writes a tombstone keyed to (source_node, target_node, conversation_id) to prevent re-learning; correction updates the edge with a new provenance entry and tombstones the old one.

**Wipe my data**: The following table specifies exactly what is deleted and how verification occurs.

| Store | What is deleted | Verified how |
|-------|-----------------|--------------|
| wasm-SQLite graph file | All nodes, edges, provenance, tombstones | User sees an empty inspection screen |
| IndexedDB/OPFS | All indexed data, file handles | Subsequent export produces a JSON file containing only an empty object |
| localStorage/sessionStorage | Session tokens, UI state | User sees an empty inspection screen |
| Cached embeddings | All vector caches | User sees an empty inspection screen |
| Saved conversations table | All conversation records | User sees an empty inspection screen |
| Server session cookie | Session identifier | Cookie absent from subsequent requests |
| Server-side chat titles | All generated titles | API returns empty list |

Nothing can be recalled from the AIR gateway. Once a turn was sent, it is outside the app's control, which is why redaction happens before the send, not after. Browser-level caches, service workers, and OPFS handles held open are outside the app's control.

**Export**: A single JSON file containing all nodes and edges with metadata (confidence, timestamp, provenance), downloadable via browser API with no account required.

**Consent framing**: Memory is OFF by default and opt-in per user. The consent dialog states one line: "Facts about your interests and preferences stay on this device. Message text—stripped of names and identifiers—is sent to ASU's own inference cluster to work out what to remember, one message at a time, with nothing linking messages to you. If memory is off, nothing is extracted at all."

## 7. The "light lights up" interaction

An ambient consent signal: a small dot in the bottom-right corner that illuminates when the assistant has learned a candidate fact about the user.

**When it fires**: Only on a new or changed candidate edge above minimum confidence (0.7), at most once per conversation turn. Debounced so a burst of five extractions becomes one glow.

**What it shows when tapped**: The candidate facts in plain language ("You seem interested in robotics - learned from this conversation"), each with three buttons: Keep, Not right, Never ask again.

**Storage behavior**: Rejected facts write a negative tombstone keyed to the inference pattern, suppressing that inference in future. Nothing enters the durable graph until approved - candidates sit in a pending buffer table. Approval moves the candidate to the main graph and deletes the pending record.

Pending candidates expire if the light is never tapped within 7 days or after 10 unevaluated facts. The same fact learned in two conversations merges into one candidate and increments `evidence_count`. A user changing their mind about a previously rejected fact is handled by a versioned tombstone: an explicit later approval with a higher version number overrides the rejection.

## 8. What is honest to claim in a five-minute pitch

| Honest to claim | Would be overclaiming |
|-----------------|----------------------|
| The profile never leaves the device | Calling it FERPA-compliant (nobody has reviewed it) |
| Inference runs on ASU-owned hardware, no external vendor | Claiming the extraction call sends nothing sensitive when it sends redacted conversation text |
| The user can see, correct and wipe everything | Claiming multi-device sync or key escrow that is not built |
| A working demo of the light and the approve/reject loop | Claiming the local model path works when it is a sketch |
| Privacy-by-design architecture | Claiming accuracy numbers from a demo with one user |

A judge should take away this: the architecture enforces data minimization at the protocol level, not as an afterthought. The user controls what is stored and can verify deletion. Inference runs on ASU infrastructure, not a third-party vendor. The consent mechanism makes privacy visible rather than hidden in a policy document.