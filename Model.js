// weather.json holds {"name": ..., "latitude": ..., "longitude": ...} (see
// omarchy-weather-location, which owns the format). Missing, blank, or
// unparseable means the location is auto-detected from the IP address.
function parseLocationFile(raw) {
  var unset = { name: "", latitude: null, longitude: null }
  try {
    var data = JSON.parse(String(raw || ""))
    if (!data || typeof data !== "object") return unset

    var latitude = parseFloat(data.latitude)
    var longitude = parseFloat(data.longitude)
    var hasCoordinates = !isNaN(latitude) && !isNaN(longitude)
    return {
      name: typeof data.name === "string" ? data.name.replace(/^\s+|\s+$/g, "") : "",
      latitude: hasCoordinates ? latitude : null,
      longitude: hasCoordinates ? longitude : null
    }
  } catch (e) {
    return unset
  }
}

// wttr.in path segment for a configured location: exact coordinates when
// both are present, the URL-encoded name as a fallback (hand-edited
// weather.loc files may only carry a name), empty for IP auto-detect.
function wttrLocationQuery(location, latitude, longitude) {
  var lat = parseFloat(String(latitude))
  var lon = parseFloat(String(longitude))
  if (!isNaN(lat) && !isNaN(lon)) return lat + "," + lon

  var name = String(location || "").replace(/^\s+|\s+$/g, "")
  return name === "" ? "" : encodeURIComponent(name)
}

// Open-Meteo geocoding response → suggestion rows for the location picker.
function parseGeocodingResults(raw) {
  try {
    var data = JSON.parse(String(raw || "{}"))
    var results = data.results
    if (!results || !results.length) return []

    var out = []
    for (var i = 0; i < results.length; i++) {
      var r = results[i]
      if (!r || !r.name || r.latitude === undefined || r.longitude === undefined) continue
      var region = [r.admin1, r.country].filter(function(part) { return !!part }).join(", ")
      out.push({
        name: String(r.name),
        description: region,
        latitude: r.latitude,
        longitude: r.longitude
      })
    }
    return out
  } catch (e) {
    return []
  }
}

function locationCommit(text, suggestions, selectedIndex) {
  var name = String(text || "").replace(/^\s+|\s+$/g, "")
  if (name === "") return { name: "", latitude: null, longitude: null }

  var choices = suggestions || []
  var index = Math.max(0, Math.min(parseInt(selectedIndex, 10) || 0, choices.length - 1))
  var suggestion = choices[index]
  if (suggestion) return suggestion

  return { name: name, latitude: null, longitude: null }
}

function isFutureForecastDate(dateString, todayString) {
  if (!dateString) return false
  return String(dateString).slice(0, 10) > String(todayString || "")
}

function roundedTemp(value) {
  if (value === undefined || value === null || value === "") return ""
  var n = parseFloat(String(value))
  return isNaN(n) ? "" : String(Math.round(n))
}

function celsiusToFahrenheit(value) {
  if (value === undefined || value === null || value === "") return ""
  var n = parseFloat(String(value))
  return isNaN(n) ? "" : (n * 9 / 5) + 32
}

function formatTemp(value, useImperial) {
  if (value === undefined || value === null || value === "") return ""
  return value + "°" + (useImperial ? "F" : "C")
}

function normalizedUnit(value) {
  return String(value || "").replace(/^\s+|\s+$/g, "").toLowerCase()
}

function localeUsesImperial(localeName) {
  var name = String(localeName || "").replace(".", "_")
  return /^en[_-]US($|[_.-])/.test(name) || /^en[_-]LR($|[_.-])/.test(name) || /^my($|[_.-])/.test(name)
}

function countryUsesImperial(countryName) {
  var country = String(countryName || "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/[._-]+/g, " ")
    .toLowerCase()
  if (!country) return null
  if (country === "us" || country === "usa" || country === "united states" || country === "united states of america") return true
  if (country === "liberia" || country === "myanmar" || country === "burma") return true
  return false
}

function shouldUseImperial(unitOverride, localeName, countryName) {
  var unit = normalizedUnit(unitOverride)
  if (unit === "imperial") return true
  if (unit === "metric") return false

  var countryPreference = countryUsesImperial(countryName)
  if (countryPreference !== null) return countryPreference

  return localeUsesImperial(localeName)
}

function dayName(dateString, formatter) {
  if (!dateString) return ""
  var d = new Date(dateString + "T12:00:00")
  if (isNaN(d.getTime())) return ""
  if (formatter) return formatter(d)
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]
}

function openMeteoForecastDays(dailyForecastReport, todayString) {
  var daily = dailyForecastReport && dailyForecastReport.daily ? dailyForecastReport.daily : null
  if (!daily || !daily.time) return []

  var result = []
  for (var i = 0; i < daily.time.length && result.length < 3; ++i) {
    var date = daily.time[i]
    if (!isFutureForecastDate(date, todayString)) continue

    var maxC = daily.temperature_2m_max ? daily.temperature_2m_max[i] : ""
    var minC = daily.temperature_2m_min ? daily.temperature_2m_min[i] : ""
    result.push({
      date: date,
      maxtempC: roundedTemp(maxC),
      mintempC: roundedTemp(minC),
      maxtempF: roundedTemp(celsiusToFahrenheit(maxC)),
      mintempF: roundedTemp(celsiusToFahrenheit(minC)),
      openMeteoWeatherCode: daily.weather_code ? daily.weather_code[i] : null
    })
  }
  return result
}

// Open-Meteo bundles current conditions with the daily forecast request and
// answers far faster than wttr.in. Normalize them to wttr's
// current_condition shape so the panel can use either source
// interchangeably. Open-Meteo reports metric (°C, km/h).
function openMeteoCurrentCondition(dailyForecastReport) {
  var current = dailyForecastReport && dailyForecastReport.current ? dailyForecastReport.current : null
  if (!current || current.temperature_2m === undefined || current.temperature_2m === null) return null
  return {
    temp_C: roundedTemp(current.temperature_2m),
    temp_F: roundedTemp(celsiusToFahrenheit(current.temperature_2m)),
    FeelsLikeC: roundedTemp(current.apparent_temperature),
    FeelsLikeF: roundedTemp(celsiusToFahrenheit(current.apparent_temperature)),
    windspeedKmph: roundedTemp(current.wind_speed_10m),
    windspeedMiles: roundedTemp(current.wind_speed_10m * 0.621371),
    windDirection: current.wind_direction_10m,
    humidity: roundedTemp(current.relative_humidity_2m),
    pressureMb: roundedTemp(current.surface_pressure),
    openMeteoWeatherCode: current.weather_code,
    isDay: current.is_day
  }
}

// Compass label for a wind direction in degrees. 8-point, empty when the
// value is missing or out of range (Open-Meteo reports degrees from north).
function windDirectionLabel(deg) {
  var d = Number(deg)
  if (!isFinite(d) || d < 0 || d > 360) return ""
  var labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return labels[Math.round(d / 45) % 8]
}

// UV index bucket: { label, level }. Level drives the accent color in the panel.
function uvInfo(uv) {
  var u = Number(uv)
  if (!isFinite(u) || u < 0) return null
  if (u <= 2) return { label: "Low", level: 0 }
  if (u <= 5) return { label: "Moderate", level: 1 }
  if (u <= 7) return { label: "High", level: 2 }
  if (u <= 10) return { label: "Very High", level: 3 }
  return { label: "Extreme", level: 4 }
}

// US AQI bucket: { label, level }. Level drives the badge color in the panel.
function aqiInfo(aqi) {
  var a = Number(aqi)
  if (!isFinite(a)) return null
  if (a <= 50) return { label: "Good", level: 0 }
  if (a <= 100) return { label: "Moderate", level: 1 }
  if (a <= 150) return { label: "Unhealthy (sensitive)", level: 2 }
  if (a <= 200) return { label: "Unhealthy", level: 3 }
  if (a <= 300) return { label: "Very Unhealthy", level: 4 }
  return { label: "Hazardous", level: 5 }
}

// "2026-08-17T14:00" -> "14:00". Open-Meteo returns local wall-clock times
// with timezone=auto, so the substring is already in the user's timezone.
function timeOf(iso) {
  var s = String(iso || "")
  return s.length >= 16 ? s.slice(11, 16) : ""
}

// Human-readable condition label for an Open-Meteo WMO weather code.
function conditionLabel(code) {
  var c = parseInt(String(code === undefined || code === null ? "0" : code), 10)
  var map = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm",
    99: "Thunderstorm"
  }
  return map[c] || "Overcast"
}

// Full-word compass label for a wind direction in degrees ("Northwest").
function windDirectionName(deg) {
  var d = Number(deg)
  if (!isFinite(d) || d < 0 || d > 360) return ""
  var labels = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"]
  return labels[Math.round(d / 45) % 8]
}

function humidityLabel(h) {
  var v = Number(h)
  if (!isFinite(v)) return ""
  if (v < 30) return "Dry"
  if (v < 50) return "Comfortable"
  if (v < 70) return "Humid"
  return "Very humid"
}

function pressureLabel(p) {
  var v = Number(p)
  if (!isFinite(v)) return ""
  if (v < 1000) return "Low"
  if (v <= 1025) return "Normal"
  return "High"
}

// Highest temperature (metric or imperial) across the hourly window, as a
// display string ("24°") for the "Day Max" header.
function hourlyMaxTemp(hourly, useImperial) {
  var max = null
  var list = hourly || []
  for (var i = 0; i < list.length; i++) {
    var raw = useImperial ? list[i].tempF : list[i].tempC
    var n = parseFloat(String(raw))
    if (isFinite(n) && (max === null || n > max)) max = n
  }
  return max === null ? "" : Math.round(max) + "°"
}

// Next 24 hours of hourly data from the daily-forecast report (which now also
// carries hourly fields). Each entry: time, tempC/tempF, precipProb, code, night.
// stepHours thins the strip so a fixed number of cells reaches further ahead:
// at 2, six cells cover twelve hours instead of six. Counted from the first
// upcoming hour, so the leading cell stays NOW.
function hourlyForecast(report, nowIso, stepHours) {
  var hourly = report && report.hourly ? report.hourly : null
  if (!hourly || !hourly.time) return []

  var step = Math.max(1, parseInt(String(stepHours), 10) || 1)
  var now = String(nowIso || "")
  var out = []
  var upcoming = 0
  for (var i = 0; i < hourly.time.length && out.length < 24; i++) {
    var t = String(hourly.time[i] || "")
    if (t && now && t < now) continue
    if (upcoming++ % step !== 0) continue
    var c = hourly.temperature_2m ? hourly.temperature_2m[i] : ""
    out.push({
      time: timeOf(t),
      tempC: roundedTemp(c),
      tempF: roundedTemp(celsiusToFahrenheit(c)),
      precipProb: hourly.precipitation_probability ? roundedTemp(hourly.precipitation_probability[i]) : "",
      code: hourly.weather_code ? hourly.weather_code[i] : null,
      night: hourly.is_day ? Number(hourly.is_day[i]) === 0 : false
    })
  }
  return out
}

// 7-day forecast (today + next six days) from the daily-forecast report.
function dailyForecast(report, todayString) {
  var daily = report && report.daily ? report.daily : null
  if (!daily || !daily.time) return []

  var out = []
  for (var i = 0; i < daily.time.length && out.length < 7; i++) {
    var date = String(daily.time[i] || "")
    var maxC = daily.temperature_2m_max ? daily.temperature_2m_max[i] : ""
    var minC = daily.temperature_2m_min ? daily.temperature_2m_min[i] : ""
    out.push({
      date: date,
      isToday: todayString ? date === String(todayString) : i === 0,
      code: daily.weather_code ? daily.weather_code[i] : null,
      maxC: roundedTemp(maxC),
      maxF: roundedTemp(celsiusToFahrenheit(maxC)),
      minC: roundedTemp(minC),
      minF: roundedTemp(celsiusToFahrenheit(minC)),
      precipProb: daily.precipitation_probability_max ? roundedTemp(daily.precipitation_probability_max[i]) : "",
      uv: daily.uv_index_max ? Number(daily.uv_index_max[i]) : null,
      sunrise: daily.sunrise ? timeOf(daily.sunrise[i]) : "",
      sunset: daily.sunset ? timeOf(daily.sunset[i]) : ""
    })
  }
  return out
}

// Today's key from the daily-forecast report (sunrise/sunset/uv max), or null.
function todayExtras(report) {
  var daily = report && report.daily ? report.daily : null
  if (!daily || !daily.time || daily.time.length === 0) return null
  return {
    sunrise: daily.sunrise ? timeOf(daily.sunrise[0]) : "",
    sunset: daily.sunset ? timeOf(daily.sunset[0]) : "",
    uv: daily.uv_index_max ? Number(daily.uv_index_max[0]) : null
  }
}

// Air quality summary from the air-quality report: US AQI plus PM2.5/PM10.
function aqiSummary(report) {
  var current = report && report.current ? report.current : null
  if (!current || current.us_aqi === undefined || current.us_aqi === null) return null
  var aqi = Number(current.us_aqi)
  if (!isFinite(aqi)) return null
  return {
    aqi: Math.round(aqi),
    pm25: current.pm2_5 !== undefined && current.pm2_5 !== null ? roundedTemp(current.pm2_5) : "",
    pm10: current.pm10 !== undefined && current.pm10 !== null ? roundedTemp(current.pm10) : "",
    info: aqiInfo(aqi)
  }
}

function currentIcon(current, fallback) {
  if (!current) return fallback || ""
  if (current.openMeteoWeatherCode !== undefined && current.openMeteoWeatherCode !== null)
    return iconForOpenMeteoCode(current.openMeteoWeatherCode, Number(current.isDay) === 0)
  if (current.weatherCode !== undefined && current.weatherCode !== null)
    return iconForCode(current.weatherCode, false)
  return fallback || ""
}

// wttr.in has no day/night flag. Use its icon only to fill an empty initial
// state, never to replace a day/night-aware icon resolved by Open-Meteo.
function provisionalCurrentIcon(current, resolvedIcon) {
  return resolvedIcon || currentIcon(current, "")
}

function weatherResponseCompletesSave(hasConfiguredCoordinates, source) {
  return hasConfiguredCoordinates ? source === "open-meteo" : source === "wttr"
}

function wttrNextForecastDays(report, todayString) {
  var days = report && report.weather ? report.weather : []
  var result = []
  for (var i = 0; i < days.length && result.length < 3; ++i) {
    if (isFutureForecastDate(days[i].date, todayString)) result.push(days[i])
  }
  return result
}

function buildForecastDays(report, dailyForecastReport, todayString) {
  var days = openMeteoForecastDays(dailyForecastReport, todayString)
  return days.length > 0 ? days : wttrNextForecastDays(report, todayString)
}

function bareTempForDay(day, kind, useImperial) {
  if (!day) return ""
  // dailyForecast() reports maxC/maxF/minC/minF; openMeteoForecastDays()
  // (the 3-day fallback) uses the maxtempC/… names. Accept both so one
  // helper serves both shapes.
  var isMax = kind === "max"
  var v = useImperial
    ? (isMax ? day.maxF : day.minF)
    : (isMax ? day.maxC : day.minC)
  if (v === undefined || v === null || v === "")
    v = useImperial
      ? (isMax ? day.maxtempF : day.mintempF)
      : (isMax ? day.maxtempC : day.mintempC)
  if (v === undefined || v === null || v === "") return ""
  return v + "°"
}

function dayIcon(day) {
  if (!day) return ""
  if (day.openMeteoWeatherCode !== undefined && day.openMeteoWeatherCode !== null)
    return iconForOpenMeteoCode(day.openMeteoWeatherCode)
  if (!day.hourly || day.hourly.length === 0) return ""

  var best = day.hourly[0]
  var bestDist = 9999
  for (var i = 0; i < day.hourly.length; ++i) {
    var t = parseInt(String(day.hourly[i].time || "0"), 10)
    var dist = Math.abs(t - 1200)
    if (dist < bestDist) {
      bestDist = dist
      best = day.hourly[i]
    }
  }
  return iconForCode(best.weatherCode, false)
}

// Open-Meteo WMO code to the WWO code the glyph and color tables are keyed by.
// Split out of iconForOpenMeteoCode so condition color resolves through the
// same mapping as the glyph and the two can never disagree.
function wwoCodeForOpenMeteo(code) {
  var c = parseInt(String(code || "0"), 10)
  if (c === 0) return 113
  if (c === 1 || c === 2) return 116
  if (c === 3) return 119
  if (c === 45 || c === 48) return 143
  if (c === 51 || c === 53 || c === 55 || c === 56 || c === 57 || c === 61) return 266
  if (c === 63 || c === 65 || c === 66 || c === 67 || c === 80 || c === 81 || c === 82) return 308
  if (c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86) return 338
  if (c === 95 || c === 96 || c === 99) return 389
  return 119
}

function iconForOpenMeteoCode(code, night) {
  return iconForCode(wwoCodeForOpenMeteo(code), night)
}

// Condition color for whichever current-condition source is authoritative,
// mirroring currentIcon's branching so glyph and color always agree.
function currentConditionColor(current, backgroundIsLight) {
  if (!current) return ""
  if (current.openMeteoWeatherCode !== undefined && current.openMeteoWeatherCode !== null)
    return conditionColor(wwoCodeForOpenMeteo(current.openMeteoWeatherCode), Number(current.isDay) === 0, backgroundIsLight)
  if (current.weatherCode !== undefined && current.weatherCode !== null)
    return conditionColor(current.weatherCode, false, backgroundIsLight)
  return ""
}

function iconForCode(code, night) {
  var c = parseInt(String(code || "0"), 10)
  switch (c) {
    case 113: return night ? "" : ""
    case 116: return night ? "" : ""
    case 119: case 122: return ""
    case 143: case 248: case 260: return night ? "\ue346" : "\ue313"
    case 176: case 263: case 353: return night ? "" : ""
    case 179: case 227: case 230: case 323: case 326: case 368: return night ? "" : ""
    case 182: case 185: case 281: case 284: case 311: case 314:
    case 317: case 320: case 350: case 362: case 365: case 374: case 377: return ""
    case 200: case 386: case 389: case 392: case 395: return ""
    case 266: case 293: case 296: case 299: case 302: case 305: case 308: case 356: case 359: return ""
    case 329: case 332: case 335: case 338: case 371: return ""
    default: return ""
  }
}

// Condition color for an Open-Meteo code, for the hourly and 7-day strips.
function colorForOpenMeteoCode(code, night, backgroundIsLight) {
  return conditionColor(wwoCodeForOpenMeteo(code), night, backgroundIsLight)
}

// Severity ramp shared by UV and AQI. Both publish official color scales
// (WHO and EPA) whose exact values are unusable here — EPA "Hazardous" is a
// near-black maroon that vanishes on a dark bar — so these keep the scales'
// hue order (green, yellow, orange, red, violet, crimson) at luminances that
// read on either surface. Every stop measures at least 4.6:1 against both.
var SEVERITY_RAMP = [
  { onDark: "#5fd08a", onLight: "#1c7a45" },
  { onDark: "#e8d05a", onLight: "#7d6a10" },
  { onDark: "#f0a45a", onLight: "#a35a10" },
  { onDark: "#f07a7a", onLight: "#b02525" },
  { onDark: "#c48af0", onLight: "#7038c4" },
  { onDark: "#e0708f", onLight: "#8e1d3d" }
]

function severityColor(level, backgroundIsLight) {
  var i = parseInt(String(level), 10)
  if (isNaN(i)) return ""
  i = Math.max(0, Math.min(SEVERITY_RAMP.length - 1, i))
  return backgroundIsLight ? SEVERITY_RAMP[i].onLight : SEVERITY_RAMP[i].onDark
}

// ---- NWS active alerts ---------------------------------------------------

// api.weather.gov severity, ranked. Unknown sorts with the lowest rather than
// being dropped: an alert that fails to declare a severity is still an alert.
var ALERT_SEVERITY_RANK = { extreme: 4, severe: 3, moderate: 2, minor: 1, unknown: 0 }
var ALERT_NOTIFY_RANK = 3

function alertSeverityRank(severity) {
  var rank = ALERT_SEVERITY_RANK[String(severity || "").toLowerCase()]
  return rank === undefined ? 0 : rank
}

// Alerts from an api.weather.gov/alerts/active response, worst first. Returns
// null — distinct from an empty array — when the response could not be parsed,
// so the caller can keep showing a warning rather than clear it on one bad
// fetch. An empty array is a real "nothing active" answer.
function parseAlerts(raw) {
  var text = String(raw || "").replace(/^\s+|\s+$/g, "")
  if (!text) return null
  try {
    var data = JSON.parse(text)
    if (!data || !Array.isArray(data.features)) return null
    var alerts = []
    for (var i = 0; i < data.features.length; i++) {
      var f = data.features[i]
      var props = f && f.properties ? f.properties : null
      if (!props) continue
      alerts.push({
        id: String(f.id || props.id || ""),
        event: String(props.event || "Weather alert"),
        headline: String(props.headline || props.areaDesc || ""),
        severity: String(props.severity || "Unknown"),
        rank: alertSeverityRank(props.severity),
        ends: String(props.ends || props.expires || "")
      })
    }
    alerts.sort(function(a, b) {
      if (b.rank !== a.rank) return b.rank - a.rank
      return (alertIsWarning(b) ? 1 : 0) - (alertIsWarning(a) ? 1 : 0)
    })
    return alerts
  } catch (e) {
    return null
  }
}

function topAlertRank(alerts) {
  return (alerts && alerts.length > 0) ? alerts[0].rank : 0
}

// NWS severity does not separate a watch from a warning: "Severe Thunderstorm
// Watch" and "Severe Thunderstorm Warning" are both severity Severe. A watch
// means conditions are favorable and is routine in storm season; a warning
// means it is happening. Only the latter earns the urgent bar state and a
// notification — otherwise the alert becomes background noise and stops being
// read. Watches still appear in the panel.
function alertIsWarning(alert) {
  return !!alert && /warning/i.test(String(alert.event || ""))
}

function alertIsUrgent(alert) {
  if (!alert) return false
  if (alert.rank >= 4) return true
  return alert.rank >= ALERT_NOTIFY_RANK && alertIsWarning(alert)
}

function alertIsNotifiable(alert) {
  return alertIsUrgent(alert)
}

function hasUrgentAlert(alerts) {
  if (!alerts) return false
  for (var i = 0; i < alerts.length; i++) if (alertIsUrgent(alerts[i])) return true
  return false
}

// Single-quote for bash -lc. Alert text is remote content that reaches a shell
// command, so it is quoted rather than trusted.
function shellQuote(value) {
  return "'" + String(value === null || value === undefined ? "" : value).split("'").join("'\\''") + "'"
}

// "until 4:15 PM" for an ISO timestamp, empty when absent or unparseable.
function alertEndsLabel(iso, now) {
  if (!iso) return ""
  var end = new Date(iso)
  if (isNaN(end.getTime())) return ""
  var reference = now || new Date()
  var sameDay = end.toDateString() === reference.toDateString()
  var time = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return sameDay ? ("until " + time) : ("until " + end.toLocaleDateString(undefined, { weekday: "short" }) + " " + time)
}


// Condition color for the bar and hero glyphs. The shell is monochrome by
// design — Color.qml exposes only foreground/accent/urgent/muted — so this is
// a deliberate departure, and it restores what the old Waybar module had for
// free: it drew conditions as emoji (sun, sun-behind-cloud, cloud, fog, sun-
// behind-rain, rain, thunder, sleet, snowflake), which are full-color bitmaps,
// so every condition was distinct at a glance including the calm ones. Every
// family is colored here for the same reason.
//
// Two variants per family because a mid-tone that reads on a dark surface
// washes out on a light one; every entry measures at least 3.9:1 against both
// the stock dark and a light background. Hue carries the distinction, so the
// calm states are low-saturation greys and the wet ones are saturated — rain
// and showers sit close together on purpose, as do snow and sleet, since the
// glyphs already separate them. Codes are WWO, matching iconForCode.
var CONDITION_COLORS = {
  clearDay:   { onDark: "#f0b24a", onLight: "#a86a00" },
  clearNight: { onDark: "#b9c3e0", onLight: "#4a5480" },
  partly:     { onDark: "#dbc389", onLight: "#8a6d1f" },
  cloudy:     { onDark: "#9db0c2", onLight: "#455a6b" },
  fog:        { onDark: "#96a0a3", onLight: "#566063" },
  showers:    { onDark: "#7cc4f0", onLight: "#1f78b8" },
  rain:       { onDark: "#4a95e8", onLight: "#14559e" },
  storm:      { onDark: "#b48af5", onLight: "#7038c4" },
  sleet:      { onDark: "#86d9e8", onLight: "#12707f" },
  snow:       { onDark: "#cfe9f5", onLight: "#2f7186" }
}

// Families follow iconForCode's groupings, so color and glyph change together.
function conditionFamily(code, night) {
  var c = parseInt(String(code || "0"), 10)
  switch (c) {
    case 113: return night ? "clearNight" : "clearDay"
    case 116: return "partly"
    case 119: case 122: return "cloudy"
    case 143: case 248: case 260: return "fog"
    case 176: case 263: case 353: return "showers"
    case 266: case 293: case 296: case 299: case 302: case 305: case 308:
    case 356: case 359: return "rain"
    case 200: case 386: case 389: case 392: case 395: return "storm"
    case 179: case 227: case 230: case 323: case 326: case 368: return "snow"
    case 329: case 332: case 335: case 338: case 371: return "snow"
    case 182: case 185: case 281: case 284: case 311: case 314: case 317:
    case 320: case 350: case 362: case 365: case 374: case 377: return "sleet"
    // Unknown codes draw the cloud glyph, so they take the cloud color.
    default: return "cloudy"
  }
}

// Empty only when the caller has color turned off; every known condition has
// a color, so the theme foreground is no longer a fallback anything reaches.
function conditionColor(code, night, backgroundIsLight) {
  var entry = CONDITION_COLORS[conditionFamily(code, night)]
  if (!entry) return ""
  return backgroundIsLight ? entry.onLight : entry.onDark
}


// NWS radar station id. Four letters for the contiguous US (KTBW), three for
// some territories (TJUA). Anything else is rejected: the id is interpolated
// into a shell command, so a bad setting must never reach it.
function normalizedRadarStation(station) {
  var s = String(station || "").replace(/^\s+|\s+$/g, "").toUpperCase()
  return /^[A-Z]{3,4}$/.test(s) ? s : ""
}

// The station serving a point, from an api.weather.gov/points response.
function parseRadarStation(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    return normalizedRadarStation(data && data.properties ? data.properties.radarStation : "")
  } catch (e) {
    return ""
  }
}

// NWS RIDGE II animated loop: basemap, county lines, and the last hour of
// reflectivity already composited server-side.
function radarLoopUrl(station) {
  var id = normalizedRadarStation(station)
  return id ? "https://radar.weather.gov/ridge/standard/" + id + "_loop.gif" : ""
}


if (typeof module !== "undefined") {
  module.exports = {
    parseLocationFile: parseLocationFile,
    wttrLocationQuery: wttrLocationQuery,
    parseGeocodingResults: parseGeocodingResults,
    locationCommit: locationCommit,
    isFutureForecastDate: isFutureForecastDate,
    roundedTemp: roundedTemp,
    celsiusToFahrenheit: celsiusToFahrenheit,
    formatTemp: formatTemp,
    normalizedUnit: normalizedUnit,
    localeUsesImperial: localeUsesImperial,
    countryUsesImperial: countryUsesImperial,
    shouldUseImperial: shouldUseImperial,
    dayName: dayName,
    openMeteoForecastDays: openMeteoForecastDays,
    openMeteoCurrentCondition: openMeteoCurrentCondition,
    currentIcon: currentIcon,
    provisionalCurrentIcon: provisionalCurrentIcon,
    weatherResponseCompletesSave: weatherResponseCompletesSave,
    wttrNextForecastDays: wttrNextForecastDays,
    buildForecastDays: buildForecastDays,
    bareTempForDay: bareTempForDay,
    dayIcon: dayIcon,
    iconForOpenMeteoCode: iconForOpenMeteoCode,
    iconForCode: iconForCode,
    normalizedRadarStation: normalizedRadarStation,
    parseRadarStation: parseRadarStation,
    radarLoopUrl: radarLoopUrl,
    conditionFamily: conditionFamily,
    conditionColor: conditionColor,
    colorForOpenMeteoCode: colorForOpenMeteoCode,
    severityColor: severityColor,
    wwoCodeForOpenMeteo: wwoCodeForOpenMeteo,
    currentConditionColor: currentConditionColor,
    alertSeverityRank: alertSeverityRank,
    parseAlerts: parseAlerts,
    topAlertRank: topAlertRank,
    alertIsNotifiable: alertIsNotifiable,
    alertIsWarning: alertIsWarning,
    alertIsUrgent: alertIsUrgent,
    hasUrgentAlert: hasUrgentAlert,
    shellQuote: shellQuote,
    alertEndsLabel: alertEndsLabel,
    windDirectionLabel: windDirectionLabel,
    windDirectionName: windDirectionName,
    conditionLabel: conditionLabel,
    humidityLabel: humidityLabel,
    pressureLabel: pressureLabel,
    hourlyMaxTemp: hourlyMaxTemp,
    uvInfo: uvInfo,
    aqiInfo: aqiInfo,
    timeOf: timeOf,
    hourlyForecast: hourlyForecast,
    dailyForecast: dailyForecast,
    todayExtras: todayExtras,
    aqiSummary: aqiSummary
  }
}
