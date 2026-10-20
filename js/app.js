
"use strict";

// METEO INTELLIGENCE
// Live forecasts: Open-Meteo
// Interactive map: Leaflet + OpenStreetMap
// Location is requested only after the user clicks the location button.

const $ = selector => document.querySelector(selector);

const state = {
  city: "New Delhi, India",
  latitude: 28.6139,
  longitude: 77.2090,
  weather: null,
  airQuality: null,
  map: null,
  mapMarker: null,
  playing: false,
  timer: null
};

const weatherCodes = {
  0: ["Clear sky", "fa-sun"],
  1: ["Mainly clear", "fa-cloud-sun"],
  2: ["Partly cloudy", "fa-cloud-sun"],
  3: ["Overcast", "fa-cloud"],
  45: ["Fog", "fa-smog"],
  48: ["Rime fog", "fa-smog"],
  51: ["Light drizzle", "fa-cloud-rain"],
  53: ["Drizzle", "fa-cloud-rain"],
  55: ["Dense drizzle", "fa-cloud-showers-heavy"],
  56: ["Freezing drizzle", "fa-cloud-rain"],
  57: ["Freezing drizzle", "fa-cloud-rain"],
  61: ["Light rain", "fa-cloud-rain"],
  63: ["Rain", "fa-cloud-showers-heavy"],
  65: ["Heavy rain", "fa-cloud-showers-heavy"],
  66: ["Freezing rain", "fa-cloud-rain"],
  67: ["Heavy freezing rain", "fa-cloud-showers-heavy"],
  71: ["Light snow", "fa-snowflake"],
  73: ["Snow", "fa-snowflake"],
  75: ["Heavy snow", "fa-snowflake"],
  77: ["Snow grains", "fa-snowflake"],
  80: ["Rain showers", "fa-cloud-showers-heavy"],
  81: ["Rain showers", "fa-cloud-showers-heavy"],
  82: ["Heavy showers", "fa-cloud-showers-heavy"],
  85: ["Snow showers", "fa-snowflake"],
  86: ["Heavy snow showers", "fa-snowflake"],
  95: ["Thunderstorm", "fa-cloud-bolt"],
  96: ["Thunderstorm with hail", "fa-cloud-bolt"],
  99: ["Severe thunderstorm", "fa-cloud-bolt"]
};

function weatherInfo(code) {
  return weatherCodes[code] || ["Weather unavailable", "fa-cloud"];
}

function number(value, suffix = "") {
  return Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "--";
}

function hourLabel(time) {
  return new Date(time).toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: false
  });
}

function dayLabel(day, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";

  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short"
  });
}

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

/* MAP */

function initializeMap() {
  const element = $("#weatherMap");

  if (!element || !window.L || state.map) return;

  state.map = L.map(element, {
    zoomControl: false
  }).setView([state.latitude, state.longitude], 5);

  L.control.zoom({ position: "topright" }).addTo(state.map);

  
L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
).addTo(state.map);


  state.mapMarker = L.marker([
    state.latitude,
    state.longitude
  ]).addTo(state.map);

  state.mapMarker.bindPopup(
    `<strong>${state.city}</strong><br>Weather location`
  );

  state.map.on("click", async event => {
    state.latitude = event.latlng.lat;
    state.longitude = event.latlng.lng;
    state.city = "Selected map location";

    updateMapLocation();
    await loadWeather();
  });

  setTimeout(() => state.map.invalidateSize(), 250);
}

function updateMapLocation() {
  if (!state.map || !state.mapMarker) return;

  const coordinates = [state.latitude, state.longitude];

  state.map.setView(coordinates, Math.max(state.map.getZoom(), 6));
  state.mapMarker.setLatLng(coordinates);
  state.mapMarker.setPopupContent(
    `<strong>${state.city}</strong><br>Weather location`
  );

  $("#currentCity").textContent = state.city;

  setTimeout(() => state.map.invalidateSize(), 100);
}

/* WEATHER */

async function loadWeather() {
  $("#currentCity").textContent = state.city;
  $("#weatherDescription").textContent = "Loading weather...";

  const params = new URLSearchParams({
    latitude: state.latitude,
    longitude: state.longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "weather_code",
      "pressure_msl",
      "surface_pressure",
      "wind_speed_10m",
      "wind_gusts_10m"
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "visibility",
      "uv_index",
      "pressure_msl"
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
      "uv_index_max"
    ].join(","),
    forecast_days: "10",
    timezone: "auto"
  });

  try {
    const data = await getJSON(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );

    state.weather = data;

    renderCurrent(data);
    renderHourly(data);
    renderDaily(data);
    renderMetrics(data);
    renderOperations(data);
    renderTimeline(data);
    drawPressureChart(data);

    $("#weatherDescription").textContent =
      weatherInfo(data.current.weather_code)[0];

    if (state.mapMarker) {
      state.mapMarker.setPopupContent(
        `<strong>${state.city}</strong><br>` +
        `${number(data.current.temperature_2m)}°C · ` +
        `${weatherInfo(data.current.weather_code)[0]}`
      );
    }

    await loadAirQuality();
  } catch (error) {
    console.error("Weather error:", error);

    $("#weatherDescription").textContent =
      "Weather unavailable. Check your connection and retry.";

    $("#hourlyForecast").textContent =
      "Hourly forecast unavailable.";

    $("#dailyForecast").textContent =
      "Daily forecast unavailable.";
  }
}

function renderCurrent(data) {
  const c = data.current;
  const info = weatherInfo(c.weather_code);

  $("#currentTemp").textContent = number(c.temperature_2m) + "°";

  $("#feelsLike").textContent =
    number(c.apparent_temperature) + "°C";

  $("#currentHumidity").textContent =
    number(c.relative_humidity_2m) + "%";

  $("#currentWind").textContent =
    number(c.wind_speed_10m) + " km/h";

  $(".temperature-display i").className =
    `fa-solid ${info[1]}`;
}

function renderHourly(data) {
  const h = data.hourly;
  const currentTime = new Date(data.current.time);

  let start = h.time.findIndex(t => new Date(t) >= currentTime);
  if (start < 0) start = 0;

  $("#hourlyForecast").innerHTML =
    h.time.slice(start, start + 6).map((time, offset) => {
      const i = start + offset;
      const info = weatherInfo(h.weather_code[i]);

      return `
        <div class="hourly-item">
          <span>${offset === 0 ? "Now" : hourLabel(time)}</span>
          <i class="fa-solid ${info[1]}" title="${info[0]}"></i>
          <strong>${number(h.temperature_2m[i])}°</strong>
        </div>
      `;
    }).join("");
}

function renderDaily(data) {
  const d = data.daily;

  const minimum = Math.min(...d.temperature_2m_min);
  const maximum = Math.max(...d.temperature_2m_max);
  const span = Math.max(1, maximum - minimum);

  $("#dailyForecast").innerHTML =
    d.time.map((day, i) => {
      const info = weatherInfo(d.weather_code[i]);
      const low = d.temperature_2m_min[i];
      const high = d.temperature_2m_max[i];
      const left = ((low - minimum) / span) * 30;
      const width = Math.max(12, ((high - low) / span) * 70);

      return `
        <div class="daily-item">
          <span class="day">${dayLabel(day, i)}</span>
          <i class="fa-solid ${info[1]}" title="${info[0]}"></i>
          <span class="low">${number(low)}° / ${number(high)}°</span>
          <div class="range"
            title="${info[0]}"
            style="margin-left:${left}%;width:${Math.min(width, 100-left)}%">
          </div>
        </div>
      `;
    }).join("");
}

function renderMetrics(data) {
  const c = data.current;
  const h = data.hourly;

  let i = h.time.findIndex(t => t >= c.time);
  if (i < 0) i = 0;

  $("#windValue").textContent = number(c.wind_speed_10m);
  $("#gustValue").textContent = number(c.wind_gusts_10m);
  $("#rainValue").textContent = number(c.precipitation);
  $("#pressureValue").textContent = number(c.pressure_msl);
  $("#humidityValue").textContent = number(c.relative_humidity_2m);
  $("#uvValue").textContent = number(h.uv_index[i]);

  const visibility = h.visibility[i];

  $("#visibilityValue").textContent =
    Number.isFinite(visibility)
      ? (visibility / 1000).toFixed(1)
      : "--";
}

function renderOperations(data) {
  const c = data.current;
  const h = data.hourly;

  let i = h.time.findIndex(t => t >= c.time);
  if (i < 0) i = 0;

  $("#opWind").textContent = number(c.wind_speed_10m) + " km/h";
  $("#opPressure").textContent = number(c.pressure_msl) + " hPa";
  $("#opHumidity").textContent = number(c.relative_humidity_2m) + "%";

  $("#opVisibility").textContent =
    Number.isFinite(h.visibility[i])
      ? (h.visibility[i] / 1000).toFixed(1) + " km"
      : "--";
}

/* AIR QUALITY */

async function loadAirQuality() {
  const params = new URLSearchParams({
    latitude: state.latitude,
    longitude: state.longitude,
    hourly: "us_aqi,pm2_5",
    timezone: "auto",
    forecast_days: "1"
  });

  try {
    const data = await getJSON(
      `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`
    );

    state.airQuality = data;

    const times = data.hourly.time;
    let i = times.findIndex(t => new Date(t) >= new Date());

    if (i < 0) i = 0;

    const aqi = data.hourly.us_aqi[i];

    $("#aqiValue").textContent =
      Number.isFinite(aqi) ? Math.round(aqi) : "--";

    $("#aqiStatus").textContent = aqiStatus(aqi);
    $("#aqiValue").style.color = aqiColor(aqi);
    $("#aqiStatus").style.color = aqiColor(aqi);

    drawAqiChart(data.hourly.us_aqi);
    renderAlerts(state.weather, aqi);
  } catch (error) {
    console.error("Air quality error:", error);

    $("#aqiValue").textContent = "--";
    $("#aqiStatus").textContent = "Unavailable";
    $("#alertList").textContent =
      "Air-quality data is currently unavailable.";
  }
}

function aqiStatus(aqi) {
  if (!Number.isFinite(aqi)) return "Unavailable";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

function aqiColor(aqi) {
  if (!Number.isFinite(aqi)) return "#8199af";
  if (aqi <= 50) return "#00e6a0";
  if (aqi <= 100) return "#e7df55";
  if (aqi <= 150) return "#ffab52";
  if (aqi <= 200) return "#ff637d";
  return "#bc86ff";
}

function renderAlerts(data, aqi) {
  const alerts = [];
  const c = data?.current;

  if (c && c.weather_code >= 95) {
    alerts.push({
      icon: "fa-cloud-bolt",
      title: "Thunderstorm conditions",
      detail: "Thunderstorm reported in current weather data."
    });
  }

  if (c && c.wind_gusts_10m >= 60) {
    alerts.push({
      icon: "fa-wind",
      title: "High wind gusts",
      detail: "Gusts are at or above 60 km/h."
    });
  }

  if (Number.isFinite(aqi) && aqi > 100) {
    alerts.push({
      icon: "fa-smog",
      title: "Elevated AQI",
      detail: `Air Quality Index: ${Math.round(aqi)}.`
    });
  }

  $("#alertList").innerHTML = alerts.length
    ? alerts.map(a => `
        <div class="alert-item">
          <i class="fa-solid ${a.icon}"></i>
          <div>
            <strong>${a.title}</strong>
            <span>${a.detail}</span>
          </div>
        </div>
      `).join("")
    : "<p>No threshold-based conditions detected by this demo.</p>";
}

/* CHARTS */

function drawLineChart(canvas, values, color, fill = false) {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(200, rect.width);
  const height = Math.max(35, rect.height);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const clean = values.filter(Number.isFinite);
  if (clean.length < 2) return;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = Math.max(1, max - min);

  const points = clean.map((value, i) => ({
    x: i / (clean.length - 1) * width,
    y: height - 5 - ((value - min) / span) * (height - 10)
  }));

  ctx.beginPath();

  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });

  if (fill) {
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 230, 160, .10)";
    ctx.fill();
  }

  ctx.beginPath();

  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.stroke();
}

function drawPressureChart(data) {
  const h = data.hourly;
  let i = h.time.findIndex(t => t >= data.current.time);

  if (i < 0) i = 0;

  drawLineChart(
    $("#pressureChart"),
    h.pressure_msl.slice(i, i + 24),
    "#21bfff"
  );
}

function drawAqiChart(values) {
  drawLineChart($("#aqiChart"), values.slice(0, 24), "#00e6a0", true);
}

/* TIMELINE: FORECAST HOUR SELECTOR, NOT RADAR PLAYBACK */

function renderTimeline(data) {
  const hour = Number(data.current.time.slice(11, 13));

  $("#timelineRange").value = Number.isFinite(hour) ? hour : 12;
  updateTimelineLabel();
}

function updateTimelineLabel() {
  const hour = Number($("#timelineRange").value);

  $("#timelinePlay").title =
    `Selected forecast hour: ${String(hour).padStart(2, "0")}:00`;
}

function stopTimeline() {
  state.playing = false;

  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  $("#timelinePlay").innerHTML =
    '<i class="fa-solid fa-play"></i>';
}

function toggleTimeline() {
  if (state.playing) {
    stopTimeline();
    return;
  }

  state.playing = true;
  $("#timelinePlay").innerHTML =
    '<i class="fa-solid fa-pause"></i>';

  state.timer = setInterval(() => {
    const range = $("#timelineRange");
    const speed = parseInt($("#timelineSpeed").value, 10) || 1;

    range.value = (Number(range.value) + speed) % 25;
    updateTimelineLabel();
  }, 1000);
}

/* CITY SEARCH */

async function searchCity() {
  const input = $("#citySearch");
  const query = input.value.trim();

  if (!query) {
    input.focus();
    return;
  }

  input.disabled = true;

  try {
    const params = new URLSearchParams({
      name: query,
      count: "1",
      language: "en",
      format: "json"
    });

    const result = await getJSON(
      `https://geocoding-api.open-meteo.com/v1/search?${params}`
    );

    if (!result.results?.length) {
      alert("City not found. Try another city name.");
      return;
    }

    const place = result.results[0];

    state.city = [place.name, place.country]
      .filter(Boolean)
      .join(", ");

    state.latitude = place.latitude;
    state.longitude = place.longitude;

    updateMapLocation();
    await loadWeather();
  } catch (error) {
    console.error("City search failed:", error);
    alert("Unable to search. Check your internet connection.");
  } finally {
    input.disabled = false;
  }
}

/* DEVICE LOCATION */

function detectMyLocation() {
  if (!navigator.geolocation) {
    alert("Your browser does not support location detection.");
    return;
  }

  if (!window.isSecureContext) {
    alert("Open this app using localhost or HTTPS to use location.");
    return;
  }

  const button = $("#locateMe");
  button.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async position => {
      state.latitude = position.coords.latitude;
      state.longitude = position.coords.longitude;
      state.city = "My Location";

      updateMapLocation();

      try {
        const params = new URLSearchParams({
          latitude: state.latitude,
          longitude: state.longitude,
          language: "en",
          format: "json"
        });

        const result = await getJSON(
          `https://geocoding-api.open-meteo.com/v1/reverse?${params}`
        );

        const place = result.results?.[0];

        if (place) {
          state.city = [place.name, place.country]
            .filter(Boolean)
            .join(", ");
        }
      } catch (error) {
        console.warn("Location name lookup failed:", error);
      }

      $("#currentCity").textContent = state.city;

      updateMapLocation();
      await loadWeather();

      button.disabled = false;
    },
    error => {
      button.disabled = false;

      const messages = {
        1: "Location permission denied. Allow access in browser settings.",
        2: "Your location is unavailable. Try again.",
        3: "Location request timed out. Try again."
      };

      alert(messages[error.code] || "Could not detect your location.");
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    }
  );
}

/* ASSISTANT DEMO — NOT A CONNECTED AI MODEL */

function sendAssistantMessage() {
  const input = $("#aiInput");
  const question = input.value.trim();

  if (!question) return;

  const message = document.createElement("p");

  message.textContent =
    `Demo assistant received: "${question}". ` +
    "AI-generated responses require a separate AI service integration.";

  message.style.cssText =
    "padding:12px;color:#a8bbce;line-height:1.7;overflow-wrap:anywhere;";

  $(".assistant-message").appendChild(message);
  input.value = "";
}

/* EVENT HANDLERS */

function setupInteractions() {
  $("#citySearch").addEventListener("keydown", event => {
    if (event.key === "Enter") searchCity();
  });

  $("#locateMe").addEventListener("click", detectMyLocation);

  $("#aiSend").addEventListener("click", sendAssistantMessage);

  $("#aiInput").addEventListener("keydown", event => {
    if (event.key === "Enter") sendAssistantMessage();
  });

  $("#timelineRange").addEventListener("input", updateTimelineLabel);

  $("#timelinePlay").addEventListener("click", toggleTimeline);

  $("#timelineBack").addEventListener("click", () => {
    $("#timelineRange").value =
      Math.max(0, Number($("#timelineRange").value) - 1);

    updateTimelineLabel();
  });

  $("#timelineNext").addEventListener("click", () => {
    $("#timelineRange").value =
      Math.min(24, Number($("#timelineRange").value) + 1);

    updateTimelineLabel();
  });

  $("#viewStorm").addEventListener("click", () => {
    alert(
      "Storm tracking is not connected yet. " +
      "This map currently displays geographic tiles and weather locations."
    );
  });

  $("#allAlerts").addEventListener("click", () => {
    alert(
      "These are basic weather thresholds, not official severe-weather warnings."
    );
  });

  document.querySelectorAll(".layer-panel input").forEach(input => {
    input.addEventListener("change", () => {
      input.title = input.checked
        ? "Layer selected; weather overlay integration is coming next."
        : "Layer deselected.";
    });
  });

  window.addEventListener("resize", () => {
    if (state.map) state.map.invalidateSize();

    if (state.weather) drawPressureChart(state.weather);

    if (state.airQuality) {
      drawAqiChart(state.airQuality.hourly.us_aqi);
    }
  });
}

/* START APP */

document.addEventListener("DOMContentLoaded", () => {
  setupInteractions();
  initializeMap();
  loadWeather();
});