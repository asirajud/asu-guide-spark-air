# asu-weather-api

Tempe weather as a **tool**. `get_weather` returns current conditions, an hourly strip (temperature,
feels-like, chance of rain, UV, wind, condition), today's high/low/UV/sunrise/sunset and one line of
plain heat guidance. Registered with `asu-tools-api`; Sol calls it when a student asks about the
weather or the heat and the chat draws the hourly card.

Source: [Open-Meteo](https://open-meteo.com) — free, keyless, no personal data. Cached 5 minutes.
Location is fixed to the ASU Tempe campus on purpose.

```
GET /health · GET /tools · POST /weather { hours? }
```

Port 5005. `pnpm dev`.
