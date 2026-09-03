# Assets

| file | made with | size | use |
| --- | --- | --- | --- |
| `hero-flux2-air-1536x640.png` | **`flux-2` on ASU AIR** (`POST /v1/images/generations`, ~68s) | 1536×640 | Submission hero. Generated on ASU's own Gaudi hardware — no external image service. |
| `architecture-codex-1774x887.png` | GPT-Image, local ChatGPT quota | 1774×887 | Deck illustration only. ⚠️ Its annotations contain invented figures (`<150ms p95_target`) — crop or correct before showing. |

Real measured latencies, if the illustration is ever re-annotated: speech 0.4s ·
image 1.8s · chat 1.7s · titles 0.3s · rerank 0.15s.

## App mark

`../asu-guide/public/mark.png` — a gold brain struck by a maroon lightning bolt, used in the empty state and side nav. Generated on AIR with `flux-2` (512×512), background keyed out. Every other candidate from the same session is in `logo-candidates/` (`sheet-defg.png` shows the final four side by side). `pitchfork.png` is ASU's registered athletics mark, kept for reference only; it is not used in the app.
