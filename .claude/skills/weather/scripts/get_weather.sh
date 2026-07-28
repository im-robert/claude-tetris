#!/usr/bin/env bash
# Fetch current weather for a given location, or auto-detected via IP if none given.
set -u

LOCATION="${1:-}"

fetch_wttr() {
  local loc="$1"
  curl -s -m 8 "https://wttr.in/${loc}?format=j1"
}

JSON="$(fetch_wttr "$LOCATION")"

if [ -z "$JSON" ] || ! echo "$JSON" | grep -q '"current_condition"'; then
  # Fallback: geolocate via IP (or geocode the given location) then query open-meteo
  if [ -n "$LOCATION" ]; then
    GEO="$(curl -s -m 8 "https://geocoding-api.open-meteo.com/v1/search?name=$(printf '%s' "$LOCATION" | sed 's/ /%20/g')&count=1")"
    LAT="$(echo "$GEO" | grep -o '"latitude":[0-9.-]*' | head -1 | cut -d: -f2)"
    LON="$(echo "$GEO" | grep -o '"longitude":[0-9.-]*' | head -1 | cut -d: -f2)"
    NAME="$(echo "$GEO" | grep -o '"name":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')"
  else
    IPGEO="$(curl -s -m 8 "http://ip-api.com/json/")"
    LAT="$(echo "$IPGEO" | grep -o '"lat":[0-9.-]*' | cut -d: -f2)"
    LON="$(echo "$IPGEO" | grep -o '"lon":[0-9.-]*' | cut -d: -f2)"
    NAME="$(echo "$IPGEO" | grep -o '"city":"[^"]*"' | cut -d: -f2 | tr -d '"')"
  fi

  if [ -z "${LAT:-}" ] || [ -z "${LON:-}" ]; then
    echo "Error: could not determine location/coordinates for weather lookup."
    exit 1
  fi

  OM="$(curl -s -m 8 "https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code")"

  TEMP="$(echo "$OM" | grep -o '"temperature_2m":[0-9.-]*' | cut -d: -f2)"
  FEELS="$(echo "$OM" | grep -o '"apparent_temperature":[0-9.-]*' | cut -d: -f2)"
  HUM="$(echo "$OM" | grep -o '"relative_humidity_2m":[0-9.-]*' | cut -d: -f2)"
  WIND="$(echo "$OM" | grep -o '"wind_speed_10m":[0-9.-]*' | cut -d: -f2)"

  echo "Location: ${NAME:-unknown}"
  echo "Temperature: ${TEMP}C (feels like ${FEELS}C)"
  echo "Humidity: ${HUM}%"
  echo "Wind: ${WIND} km/h"
  echo "RAW_JSON:$OM"
  exit 0
fi

# Parse wttr.in j1 JSON with grep/sed (no jq dependency assumed)
FLAT="$(echo "$JSON" | tr -d '\n\r' | tr -s ' ')"
AREA="$(echo "$FLAT" | grep -o '"areaName": *\[ *{ *"value": *"[^"]*"' | head -1 | sed 's/.*"value": *"//;s/"$//')"
COUNTRY="$(echo "$FLAT" | grep -o '"country": *\[ *{ *"value": *"[^"]*"' | head -1 | sed 's/.*"value": *"//;s/"$//')"
TEMP_C="$(echo "$FLAT" | grep -o '"temp_C": *"[^"]*"' | head -1 | cut -d'"' -f4)"
FEELS_C="$(echo "$FLAT" | grep -o '"FeelsLikeC": *"[^"]*"' | head -1 | cut -d'"' -f4)"
HUMIDITY="$(echo "$FLAT" | grep -o '"humidity": *"[^"]*"' | head -1 | cut -d'"' -f4)"
WIND_KMPH="$(echo "$FLAT" | grep -o '"windspeedKmph": *"[^"]*"' | head -1 | cut -d'"' -f4)"
DESC="$(echo "$FLAT" | grep -o '"weatherDesc": *\[ *{ *"value": *"[^"]*"' | head -1 | sed 's/.*"value": *"//;s/"$//')"

echo "Location: ${AREA}${COUNTRY:+, $COUNTRY}"
echo "Condition: ${DESC}"
echo "Temperature: ${TEMP_C}C (feels like ${FEELS_C}C)"
echo "Humidity: ${HUMIDITY}%"
echo "Wind: ${WIND_KMPH} km/h"
echo "RAW_JSON:$JSON"
