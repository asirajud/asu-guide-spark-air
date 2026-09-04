# AI Study Council API Contract

## 1. Purpose and Scope

This contract defines the API for the "AI Study Council" feature, a public educational tool providing multi-perspective explanations and assessments. **Prohibitions**: No SSE, no token-level streaming, no new services/directories, no direct gateway fetch, no hardcoded model IDs, no tool calls, no authentication required.

## 2. Endpoints

| Method | Path                   | Streaming | Auth |
| ------ | ---------------------- | --------- | ---- |
| POST   | `/api/council/session` | NDJSON    | None |
| POST   | `/api/council/answer`  | JSON      | None |

## 3. POST `/api/council/session`

### Request Schema

```json
{
  "concept": "string (non-empty, max 500)",
  "course": "string (non-empty, max 100)",
  "panel": "'study' | 'rubric'",
  "explain_language": "string (non-empty, max 64)",
  "quiz_language": "string (non-empty, max 64)"
}
```

### Validation Rules

| Field              | Rule                             | 400 Error Message Example            |
| ------------------ | -------------------------------- | ------------------------------------ |
| `concept`          | Non-empty, ≤500 chars            | "concept must be ≤500 chars"         |
| `course`           | Non-empty, ≤100 chars            | "course must be ≤100 chars"          |
| `panel`            | Strictly `'study'` or `'rubric'` | "panel must be 'study' or 'rubric'"  |
| `explain_language` | Non-empty, ≤64 chars             | "explain_language must be ≤64 chars" |
| `quiz_language`    | Non-empty, ≤64 chars             | "quiz_language must be ≤64 chars"    |

### Response Stream

- **Headers**: `Content-Type: application/x-ndjson; charset=utf-8`, `Cache-Control: no-store`, `X-Accel-Buffering: no`
- **Framing**: Each event = `JSON.stringify(event) + '\n'`
- **Terminal**: Always `done` or `error` (last line)

### Event Types

```typescript
export type CouncilEvent =
  | {
      type: 'session_start'
      concept: string
      course: string
      panel: 'study' | 'rubric'
      explain_language: string
      quiz_language: string
      roster: string[]
    }
  | { type: 'panelist'; index: number; role_name: string; text: string; model: string; ms: number }
  | { type: 'panelist_failed'; index: number; role_name: string; error: string }
  | { type: 'moderator'; text: string; model: string; ms: number }
  | { type: 'moderator_failed'; error: string }
  | { type: 'done'; model_map: Record<string, string | null>; total_ms: number }
  | { type: 'error'; error: string }
```

### Event Sequence Rules

1. `session_start` (first event)
2. Panelist events (0-3 index, **completion order**, not roster order)
3. `moderator` OR `moderator_failed` (after all panelists settle)
4. Terminal: `done` (with model_map) OR `error` (if all panelists fail)
   - Error error **must** include "ASU VPN"

### Worked Examples

#### (a) Happy Path

```json
{"type":"session_start","concept":"Newton's Laws","course":"PHYS 101","panel":"study","explain_language":"en","quiz_language":"en","roster":["pedagogy_1","pedagogy_2","pedagogy_3","pedagogy_4","moderator"]}
{"type":"panelist","index":0,"role_name":"pedagogy_1","text":"Newton's First Law states...","model":"qwen35-27b","ms":1720}
{"type":"panelist","index":1,"role_name":"pedagogy_2","text":"In everyday motion...","model":"qwen35-27b","ms":1750}
{"type":"panelist","index":2,"role_name":"pedagogy_3","text":"From mathematical perspective...","model":"qwen35-27b","ms":1800}
{"type":"panelist","index":3,"role_name":"pedagogy_4","text":"Historically, Newton's First Law...","model":"qwen35-27b","ms":1850}
{"type":"moderator","text":"All perspectives confirm...","model":"qwen35-27b","ms":2100}
{"type":"done","model_map":{"pedagogy_1":"qwen35-27b","pedagogy_2":"qwen35-27b","pedagogy_3":"qwen35-27b","pedagogy_4":"qwen35-27b","moderator":"qwen35-27b"},"total_ms":7220}
```

#### (b) One Panelist Failed

```json
{"type":"session_start",...}
{"type":"panelist","index":0,"role_name":"pedagogy_1",...}
{"type":"panelist_failed","index":1,"role_name":"pedagogy_2","error":"Gateway refused model qwen35-27b (benched)"}
{"type":"panelist","index":2,"role_name":"pedagogy_3",...}
{"type":"panelist","index":3,"role_name":"pedagogy_4",...}
{"type":"moderator",...}
{"type":"done","model_map":{"pedagogy_1":"qwen35-27b","pedagogy_2":null,"pedagogy_3":"qwen35-27b","pedagogy_4":"qwen35-27b","moderator":"qwen35-27b"},"total_ms":7220}
```

#### (c) All Panelists Failed

```json
{"type":"session_start",...}
{"type":"panelist_failed","index":0,...}
{"type":"panelist_failed","index":1,...}
{"type":"panelist_failed","index":2,...}
{"type":"panelist_failed","index":3,...}
{"type":"error","error":"All panelist requests failed. Check ASU VPN connection."}
```

## 4. POST `/api/council/answer`

### Request Schema

```json
{
  "concept": "string (non-empty, max 500)",
  "course": "string (non-empty, max 100)",
  "panel": "'study' | 'rubric'",
  "question": "string (non-empty, max 200)",
  "answer": "string (non-empty, max 1000)",
  "explain_language": "string (non-empty, max 64)",
  "quiz_language": "string (non-empty, max 64)"
}
```

### Success Response

```json
{
  "verdict": "UNDERSTOOD" | "NOT_YET",
  "explanation": "string",
  "model": "string",
  "ms": 1500
}
```

### Parse Failure Rule

- Model **must** output exactly `"UNDERSTOOD <explanation>"` or `"NOT_YET <explanation>"`
- Failure = retry chain → 502 if chain fails

### 502 Response

```json
{ "error": "All models in council chain failed" }
```

### Worked Examples

#### (a) UNDERSTOOD

```json
{
  "verdict": "UNDERSTOOD",
  "explanation": "Answer correctly identifies Newton's First Law as principle of inertia.",
  "model": "qwen35-27b",
  "ms": 1500
}
```

#### (b) NOT_YET

```json
{
  "verdict": "NOT_YET",
  "explanation": "Answer confuses Newton's First Law with Second Law (force/acceleration).",
  "model": "qwen35-27b",
  "ms": 1550
}
```

## 5. Panel Role Data

### Location

`asu-guide/src/lib/council/panels.ts` (data-only module)

### Types

```typescript
export type PanelRole = {
  role_name: string
  model: string
  system_prompt: string
}

export type PanelDefinition = {
  panelists: [PanelRole, PanelRole, PanelRole, PanelRole]
  moderator: PanelRole
}
```

### Proposed Definitions

```typescript
export const PANEL_DEFINITIONS = {
  study: {
    panelists: [
      {
        role_name: 'pedagogy_1',
        model: 'qwen35-27b',
        system_prompt: 'Explain from historical perspective.',
      },
      {
        role_name: 'pedagogy_2',
        model: 'qwen35-27b',
        system_prompt: 'Explain from real-world application perspective.',
      },
      {
        role_name: 'pedagogy_3',
        model: 'qwen35-27b',
        system_prompt: 'Explain from mathematical formalism perspective.',
      },
      {
        role_name: 'pedagogy_4',
        model: 'qwen35-27b',
        system_prompt: 'Explain from misconception perspective.',
      },
    ],
    moderator: {
      role_name: 'moderator',
      model: 'qwen35-27b',
      system_prompt: 'Synthesize four perspectives into cohesive summary and verdict.',
    },
  },
  rubric: {
    panelists: [
      {
        role_name: 'rubric_1',
        model: 'qwen35-27b',
        system_prompt: 'Assess for clarity of explanation.',
      },
      {
        role_name: 'rubric_2',
        model: 'qwen35-27b',
        system_prompt: 'Assess for relevance to course outcomes.',
      },
      {
        role_name: 'rubric_3',
        model: 'qwen35-27b',
        system_prompt: 'Assess for depth of analysis.',
      },
      {
        role_name: 'rubric_4',
        model: 'qwen35-27b',
        system_prompt: 'Assess for real-world examples alignment.',
      },
    ],
    moderator: {
      role_name: 'moderator',
      model: 'qwen35-27b',
      system_prompt: 'Consolidate rubric assessments into verdict and summary.',
    },
  },
}
```

## 6. AIR Integration

### Service Chain

- **Service**: `council`
- **Chain**: `['qwen35-27b', 'gpt-oss-120b']`
- **Rationale**: `qwen35-27b` (fastest correct model, 1.7s with `thinking_off: true`); `gpt-oss-120b` safe for prose (already in chat chain).
- **Excluded**: `qwen3-235b-a22b` (slow), `qwen3-30b-a3b-instruct-2507` (wrong answers), `glm-5-3-flash` (banned).

### Role-Model Resolution

- **Mechanism**: Add `getCouncilModelChain(role: PanelRole): string[]` to `src/lib/air/models.ts`:
  ```ts
  export function getCouncilModelChain(role: PanelRole): string[] {
    return [role.model, ...MODELS.council.filter((m) => m !== role.model)]
  }
  ```
- **Semantics**: Role model first → `council` chain on refusal (slowness = no fallback).

### Budgets

| Component         | max_tokens | temperature | timeout_ms | THINKING_OFF |
| ----------------- | ---------- | ----------- | ---------- | ------------ |
| Panelist          | 600        | 0.7         | 55000      | true         |
| Moderator         | 300        | 0.3         | 45000      | true         |
| Answer Evaluation | 250        | 0.2         | 45000      | true         |

## 7. Implementation Checklist

1. Add `council` service to `MODELS` in `src/lib/air/models.ts` (copy `chat` service pattern: `models.ts:38-40`)
2. Create `panels.ts` in `src/lib/council/` with definitions (section 5)
3. Add `getCouncilModelChain` to `src/lib/air/models.ts` (section 6)
4. Create `session/route.ts` in `src/app/api/council/` (copy `video/route.ts:59-193` and `chat/route.ts:92-119`)
5. Create `answer/route.ts` in `src/app/api/council/` (copy `chat/route.ts` stateless pattern)

## 8. Prohibitions (Explicit)

- [ ] No SSE (only NDJSON)
- [ ] No token-level streaming
- [ ] No new services/directories
- [ ] No direct gateway fetch
- [ ] No hardcoded model IDs
- [ ] No tool calls
- [ ] No authentication
- [ ] No `qwen3-235b-a22b`/`qwen3-30b-a3b-instruct-2507`/`glm-5-3-flash`
- [ ] All model calls via `callAir` with `getCouncilModelChain`
- [ ] All responses use NDJSON/JSON framing
- [ ] All text outputs in request language
- [ ] `session` endpoint has `maxDuration: 120`
- [ ] `session` uses `Promise.allSettled` (video pattern)
- [ ] `answer` endpoint stateless (no session storage)
- [ ] `session` emits events in completion order
- [ ] `session` error includes "ASU VPN"
- [ ] `answer` model response starts with `UNDERSTOOD`/`NOT_YET`
