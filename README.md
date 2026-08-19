# Weathering

A weather widget for the [Omarchy](https://omarchy.org) bar. One pill in the
bar; one panel with a sectioned layout: a current-conditions hero, metric cells
(wind, humidity, pressure, UV index, air quality, sun), an hourly strip, and a
7-day forecast. All data comes from [Open-Meteo](https://open-meteo.com) — no
API key, no account.

<p align="center"><img src="weathering.png" alt="Weathering panel" width="520"></p>

## Features

| Section | Shows |
|---------|-------|
| **Current** | condition glyph, big temperature, location (click to search), feels-like / wind / precipitation chance |
| **Metrics** | filled cells: wind (speed + compass arrow), humidity, pressure, UV index, air quality, sun (rise/set) — level bars on humidity / pressure / UV |
| **Hourly** | six upcoming hours: time (NOW highlighted), condition glyph, temperature, precipitation probability, day MAX readout |
| **7-day** | one cell per day (today highlighted): condition, hi/lo |
| **Air quality** | US AQI number with health category (Good → Hazardous) plus PM2.5 / PM10 |
| **Location** | click the location label to search cities (Open-Meteo geocoding); empty commit returns to IP auto-detect |

The panel uses the theme's popup surface, so it follows dark and light themes.
Everything is metric or imperial aware (auto / metric / imperial, or per your
locale).

## Install

```sh
omarchy plugin add https://github.com/howdyitskyle/weathering-omarchy-plugin.git --enable
```

Then move it where you like on the bar (it lands in the right section by
default):

```sh
omarchy bar move io.github.howdyitskyle.weathering --section center
```

## Use

Click the pill to open or close the panel. Press Escape to close it. Middle-click
refreshes; right-click sends the current conditions as a notification.

Bind a key if you like:

```
bindd = SUPER CTRL, W, Weathering, exec, omarchy-shell shell toggle io.github.howdyitskyle.weathering '{}'
```

## Location

The plugin shares its location with the built-in `omarchy.weather` widget via
`~/.local/state/omarchy/settings/weather.json`, so setting a location in either
one keeps both in sync. Without a configured location the panel auto-detects
from your IP address.

## Configure

`omarchy bar` › the Weathering widget has these settings:

| Key | Default | Meaning |
|-----|---------|---------|
| `unit` | `auto` | `auto` / `metric` / `imperial` |
| `refreshMinutes` | `15` | refresh interval, 5–120 min |
| `showHourly` | `true` | show the hourly strip |
| `showAirQuality` | `true` | show the air-quality section |

## Data

Weather + geocoding come from Open-Meteo's free APIs (`api.open-meteo.com`,
`air-quality-api.open-meteo.com`, `geocoding-api.open-meteo.com`). There is no
account, key, or rate plan. The panel fetches on open, on location change, and
on a refresh timer that runs every `refreshMinutes` (even while the panel is
closed) so the bar pill stays current.

## Remove

```sh
omarchy plugin remove io.github.howdyitskyle.weathering
```

## License

MIT — see [LICENSE](LICENSE).