# asu-heatroute-api

HeatRoute as a **tool**, not a page. `POST /route` takes a start and a destination in the
student's own words ("the MU", "Hayden"), a departure time and two preferences, and returns
ranked, heat-scored route options. It is registered with `asu-tools-api` as `plan_heat_route`,
so Sol calls it when a student asks how to get somewhere on campus or how to stay out of the
sun — and answers in the chat with the route drawn inline.

The engine and the curated Tempe data are imported straight from `asu-guide/src/lib`
(pure TypeScript), so the tool and the `/heat` page can never disagree.

```
GET  /health · GET /tools · GET /landmarks
POST /route  { start, destination, departure?, mobility?, shuttle? }
```

Port 5004. `pnpm dev`.
