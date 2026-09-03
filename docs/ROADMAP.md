# Roadmap

Where Sol goes after the Spark build. Everything here is unbuilt; the only
thing shipped is the Notebooks entry in the side nav, which opens a static
preview and calls nothing.

## Notebooks

A chat starts from nothing every time. The conversation is the context, the
context dies with the tab, and a long thread eventually pushes its own opening
out of the window. That is fine for "what's happening tonight" and wrong for
anything a student carries across a semester — a transfer evaluation, a
syllabus, a term's worth of advising.

A Notebook is a **project**: a durable, named workspace that owns its own
documents, its own extracted knowledge, and its own conversations. Sessions
belong to a Notebook rather than floating free, and a question asked in one is
answered against everything that Notebook holds, not against the last few
turns.

### Why not just a longer context window

Three reasons, in order of how quickly they bite:

1. **Cost and latency scale with what you resend.** Replaying a semester of
   documents on every turn is linear in history for an answer that needs three
   paragraphs of it. Retrieval is sublinear.
2. **Recall degrades in the middle.** Long contexts reliably lose material that
   sits neither at the start nor the end. A student's week-one upload is exactly
   the material that lands there.
3. **AIR's ceiling is finite.** The largest model on the gateway tops out at
   131K. A Notebook is designed to outlive any single window.

### Shape

Per Notebook, three stores that answer different questions:

| Store          | Answers                             | Backing                                                      |
| -------------- | ----------------------------------- | ------------------------------------------------------------ |
| Document store | "what did they actually upload"     | Files on disk, sha256-keyed, one row per source              |
| Entity graph   | "how do these things relate"        | Extracted entities + typed relations, scoped to the notebook |
| Vector index   | "what is relevant to this question" | Chunk embeddings, filtered by notebook id before search      |

**Ingest.** A document is chunked, embedded, and passed once through an
extraction pass that pulls entities (courses, deadlines, requirements, people,
places) and the relations between them (`CSE 340` _requires_ `CSE 240`;
`transfer petition` _due_ `Oct 14`). Extraction runs once at ingest, not per
query — the expensive pass is amortised over every later question.

**Retrieval.** A question hits the vector index for semantically near chunks and
the graph for structurally near facts, and the union — deduped, reranked, capped
to a budget — becomes the turn's context. The model sees a small, dense, relevant
prompt regardless of how much the Notebook holds.

**Isolation.** Notebook id is a hard filter on every store, not a ranking signal.
Two notebooks belonging to the same student never see each other's chunks, and
neither can pull the other into a prompt.

### What has to be decided first

- **Where the vectors live.** SQLite with `sqlite-vec` keeps the single-file
  deploy and is almost certainly enough at demo scale; a real index (pgvector,
  Qdrant) is the answer only once notebooks are shared or large.
- **Which AIR model does extraction.** Entity/relation extraction wants
  structured output and tolerates latency, so it is a different pick from the
  chat model — likely one of the instruct models with thinking off, run in a
  queue rather than in the request path.
- **Embeddings on AIR or local.** If the gateway exposes no embedding endpoint,
  a small local model is the fallback, which changes the deployment story.
- **Re-extraction on edit.** A replaced document has to invalidate its chunks
  and the relations derived from them. Cheap to get wrong, expensive to notice.

### Privacy line

`docs/PRIVACY-AND-MEMORY.md` sets the rule this has to satisfy: no persistent,
identifiable record of inferred interests keyed to an ASURITE. A Notebook is
student-created and student-scoped rather than inferred, which is a different
category from a behavioural profile — but the extracted graph is derived data
about a named person, and it lands server-side. That needs its own section in
that document, settled **before** any extraction code is written, not after.
Uploaded documents may also be student records; the FERPA question is real and
is not answered by "the student uploaded it themselves."

## Daily brief

One read of the day before the student goes looking for it: what is due, what
moved, what is worth walking across campus for. Assembled once each morning
rather than asked for.

The event half already works — Sun Devil Central is wired up, and the preview
renders real entries from the live feed. Everything else is a connector problem,
not a model problem:

| Source            | Contributes                                                      | Status      |
| ----------------- | ---------------------------------------------------------------- | ----------- |
| Sun Devil Central | Events, clubs, RSVPs                                             | Connected   |
| Google Calendar   | Classes and existing commitments, so the brief works around them | Needs #6    |
| Canvas            | Due dates, new announcements, grade changes                      | Not started |

The preview shows the missing ones as **Not yet** rather than faking their
output, so a demo cannot imply the brief reads a calendar it has never seen.

### What has to be decided first

- **When it runs.** A brief assembled on open is simple and always fresh; one
  assembled on a schedule is what makes it a _morning_ brief but needs a job
  runner and somewhere to put the result.
- **Whether it is a chat turn or its own surface.** Rendering it as an assistant
  turn gets follow-up questions for free and pollutes the thread list; a
  separate surface is cleaner and cannot be interrogated.
- **What crosses the AIR boundary.** Same line as #6 draws: assignment titles
  and due dates from Canvas are student records. Summarising them means sending
  them to the gateway, which `docs/PRIVACY-AND-MEMORY.md` currently forbids.
  Either the brief composes deterministically from structured fields with no
  model call, or that document needs revisiting first. Deterministic composition
  is the cheaper answer and probably the right one.

## Also queued

Tracked as GitHub issues, listed here for shape:

- **#6 Google Calendar connector** — RSVPs land on a real calendar; free/busy
  informs "what can I go to Tuesday". Gated: no calendar content in any AIR
  request body.
- **#7 Persistent media per chat** — uploaded flyers survive a reload instead of
  dying with their object URL.
- **#10 Search source chips and link cards** — `web_search` results already
  carry title, host and thumbnail; the reply currently drops all of it.
