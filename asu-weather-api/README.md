# asu-weather-api

Weather as a **tool**. `get_weather` returns current conditions, an hourly strip (temperature,
feels-like, chance of rain, UV, wind, condition), today's high/low/UV/sunrise/sunset and one line of
plain heat guidance. Registered with `asu-tools-api`; Sol calls it when a student asks about the
weather or the heat and the chat draws the hourly card.

Source: [Open-Meteo](https://open-meteo.com) — free, keyless, no personal data. Cached 5 minutes per
place. Defaults to the ASU Tempe campus, because that is what a campus assistant is asked about; a
`place` in the student's own words ("San Francisco", "Barcelona") is resolved through Open-Meteo's
geocoder, and a name that resolves to nothing comes back as a `404` with a hint rather than a
guessed forecast.

```
GET /health · GET /tools · POST /weather { place?, hours? }
```

Port 5005. `pnpm dev`.
