---
name: weather
description: Get the current local weather (temperature, conditions, wind, humidity) for the user's detected location, or for a city/location they name. Use when the user asks "what's the weather", "clima", "how's the weather today", "will it rain", or asks for a forecast.
---

# Weather

Fetches current weather conditions using free, no-API-key services. Works offline of any project dependency — just needs internet access and `curl`.

## How it works

1. If the user names a location (city, zip, airport code, "Madrid", "10001", etc.), use that as the query.
2. If no location is given, auto-detect it from the caller's IP (default behavior of the underlying service).
3. Run the script:

```bash
bash .claude/skills/weather/scripts/get_weather.sh "<location or empty>"
```

Examples:
- `bash .claude/skills/weather/scripts/get_weather.sh` → weather for auto-detected location
- `bash .claude/skills/weather/scripts/get_weather.sh "Santo Domingo"` → weather for that city
- `bash .claude/skills/weather/scripts/get_weather.sh "10001"` → weather for that zip code

The script prints a compact human-readable report (location, condition, temperature, feels-like, humidity, wind) and also emits the raw JSON on a `RAW_JSON:` line in case more detail is needed (e.g. multi-day forecast).

## Notes

- Uses `wttr.in` (no key required) as the primary source. If it's unreachable, falls back to `open-meteo.com` combined with `ip-api.com` for IP-based geolocation.
- Report the result to the user in plain language (e.g. "It's 24°C and partly cloudy in Santo Domingo, feels like 26°C, 60% humidity, wind 12 km/h"). Don't dump raw JSON at the user unless they ask for details.
- This has nothing to do with the Tetris game itself — it's a general-purpose local utility skill kept at the project level per the user's request.
