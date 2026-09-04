# Council Chat Mode Contract

The Council is a reasoning mode of the normal Sol chat. It is not a separate
page, form, or answer checker. Students select it beside Fast and Deep, write a
normal message, and receive one final answer after several AIR agents challenge
the lead response.

## Request

`POST /api/chat` uses the existing chat body with a mode field:

```json
{
  "mode": "council",
  "messages": [{ "role": "user", "content": "Which option is stronger?" }]
}
```

`mode` is one of `fast`, `deep`, or `council`. The legacy `deep: true` field is
still accepted. Identity always comes from the signed server session.

## Orchestration

1. A tool-capable lead researcher runs the existing bounded chat loop. This
   keeps Events, HeatRoute, Weather, and other registered tools available.
2. The evidence reviewer, skeptic, and student advocate inspect the same lead
   answer in parallel with `Promise.allSettled`.
3. The Council chair receives the successful positions and tool evidence, then
   resolves disagreements into the final answer.
4. If a reviewer fails, the remaining members continue. If the chair fails,
   the verified lead answer is returned instead.

All model calls go through `callAir('council', ...)` and role-specific chains
from `getCouncilModelChain`. There are no client-side gateway credentials,
direct gateway calls, token-level streams, or unbounded agent loops.

## Response

The route preserves the existing newline-delimited JSON transport. Council
mode adds progress events:

```ts
type CouncilProgress =
  | {
      type: 'council_start'
      id: string
      role: string
      label: string
      round: number
    }
  | {
      type: 'council_end'
      id: string
      ok: boolean
      ms: number
      summary: string
    }
```

The terminal `done` event retains the normal chat fields and may include the
positions displayed in the expandable transcript:

```ts
type CouncilContribution = {
  role: string
  text: string
  model: string
  ms: number
}
```

Tool events may appear between Council events when the lead researcher needs
live data. The final NDJSON line is always `done` or `error`.
