const API_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

const weatherDescriptions = {
  0: ['Clear sky', '☀️', 'clear'],
  1: ['Mainly clear', '🌤️', 'partly-cloudy'],
  2: ['Partly cloudy', '⛅', 'partly-cloudy'],
  3: ['Overcast', '☁️', 'cloudy'],
  45: ['Foggy', '🌫️', 'cloudy'],
  48: ['Rime fog', '🌫️', 'cloudy'],
  51: ['Light drizzle', '🌦️', 'rain'],
  53: ['Drizzle', '🌦️', 'rain'],
  55: ['Heavy drizzle', '🌧️', 'rain'],
  56: ['Freezing drizzle', '🌧️', 'rain'],
  57: ['Heavy freezing drizzle', '🌧️', 'rain'],
  61: ['Light rain', '🌦️', 'rain'],
  63: ['Rain', '🌧️', 'rain'],
  65: ['Heavy rain', '🌧️', 'rain'],
  66: ['Freezing rain', '🌧️', 'rain'],
  67: ['Heavy freezing rain', '🌧️', 'rain'],
  71: ['Light snow', '🌨️', 'snow'],
  73: ['Snow', '❄️', 'snow'],
  75: ['Heavy snow', '❄️', 'snow'],
  77: ['Snow grains', '❄️', 'snow'],
  80: ['Light showers', '🌦️', 'rain'],
  81: ['Rain showers', '🌧️', 'rain'],
  82: ['Heavy showers', '🌧️', 'rain'],
  85: ['Snow showers', '🌨️', 'snow'],
  86: ['Heavy snow showers', '❄️', 'snow'],
  95: ['Thunderstorm', '⛈️', 'storm'],
  96: ['Thunderstorm with hail', '⛈️', 'storm'],
  99: ['Thunderstorm with heavy hail', '⛈️', 'storm'],
};

const elements = {
  form: document.querySelector('#search-form'),
  input: document.querySelector('#city-input'),
  status: document.querySelector('#status'),
  card: document.querySelector('#current-card'),
  place: document.querySelector('#place-name'),
  date: document.querySelector('#current-date'),
  icon: document.querySelector('#current-icon'),
  temperature: document.querySelector('#temperature'),
  condition: document.querySelector('#condition'),
  feelsLike: document.querySelector('#feels-like'),
  humidity: document.querySelector('#humidity'),
  wind: document.querySelector('#wind'),
  precipitation: document.querySelector('#precipitation'),
  forecast: document.querySelector('#forecast-list'),
  unitToggle: document.querySelector('#unit-toggle'),
  locationButton: document.querySelector('#location-button'),
};

let useFahrenheit = false;
let latestWeather = null;
let requestNumber = 0;

function describeWeather(code) {
  return weatherDescriptions[code] || ['Unknown conditions', '🌡️', ''];
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('is-error', isError);
}

function setLoading(isLoading) {
  elements.card.setAttribute('aria-busy', String(isLoading));
  elements.form.querySelector('button').disabled = isLoading;
  elements.locationButton.disabled = isLoading;
  if (isLoading) setStatus('Finding your forecast...');
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather service is unavailable. Please try again.');
  return response.json();
}

async function searchCity(city) {
  const url = new URL(GEOCODING_BASE);
  url.search = new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' });
  const data = await getJson(url);
  if (!data.results?.length) throw new Error(`We couldn't find “${city}”. Try another city.`);
  const place = data.results[0];
  return loadWeather(place.latitude, place.longitude, [place.name, place.admin1, place.country].filter(Boolean).join(', '));
}

async function loadWeather(latitude, longitude, placeName) {
  const currentRequest = ++requestNumber;
  setLoading(true);
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      temperature_unit: useFahrenheit ? 'fahrenheit' : 'celsius',
      wind_speed_unit: useFahrenheit ? 'mph' : 'kmh',
      timezone: 'auto',
      forecast_days: '6',
    });
    const data = await getJson(`${API_BASE}?${params}`);
    if (currentRequest !== requestNumber) return;
    latestWeather = { data, placeName };
    renderWeather();
    setStatus('');
  } catch (error) {
    if (currentRequest === requestNumber) setStatus(error.message || 'Could not load weather. Please try again.', true);
  } finally {
    if (currentRequest === requestNumber) setLoading(false);
  }
}

function formatDate(dateString, options) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${dateString}T12:00:00`));
}

function renderWeather() {
  if (!latestWeather) return;
  const { data, placeName } = latestWeather;
  const current = data.current;
  const units = data.current_units;
  const [description, icon] = describeWeather(current.weather_code);
  const currentIcon = current.is_day ? icon : (current.weather_code === 0 || current.weather_code === 1 ? '🌙' : icon);

  elements.place.textContent = placeName;
  elements.date.textContent = formatDate(current.time.slice(0, 10), { weekday: 'long', month: 'long', day: 'numeric' });
  elements.icon.textContent = currentIcon;
  elements.temperature.innerHTML = `${Math.round(current.temperature_2m)}<span>°</span>`;
  elements.condition.textContent = description;
  elements.feelsLike.textContent = `Feels like ${Math.round(current.apparent_temperature)}${units.apparent_temperature}`;
  elements.humidity.textContent = `${current.relative_humidity_2m}${units.relative_humidity_2m}`;
  elements.wind.textContent = `${Math.round(current.wind_speed_10m)} ${units.wind_speed_10m}`;
  elements.precipitation.textContent = `${current.precipitation}${units.precipitation}`;
  renderForecast(data.daily, units.temperature_2m);
}

function renderForecast(daily, temperatureUnit) {
  const days = daily.time.slice(1, 6).map((date, index) => {
    const dayIndex = index + 1;
    const [description, icon] = describeWeather(daily.weather_code[dayIndex]);
    const high = Math.round(daily.temperature_2m_max[dayIndex]);
    const low = Math.round(daily.temperature_2m_min[dayIndex]);
    const rain = daily.precipitation_probability_max[dayIndex];
    return `<article class="forecast-day">
      <p class="forecast-date">${formatDate(date, { weekday: 'short' })}<span>${formatDate(date, { month: 'short', day: 'numeric' })}</span></p>
      <span class="forecast-icon" role="img" aria-label="${description}">${icon}</span>
      <p class="forecast-condition">${description}</p>
      <p class="forecast-temperatures"><strong>${high}°</strong><span>${low}°</span></p>
      <p class="rain-chance">💧 ${rain ?? '—'}%</p>
    </article>`;
  });
  elements.forecast.innerHTML = days.join('');
  document.querySelectorAll('.forecast-day').forEach((day) => {
    day.setAttribute('aria-label', `${day.querySelector('.forecast-date').textContent.replace('\n', ' ')}, ${day.querySelector('.forecast-condition').textContent}, high ${day.querySelector('strong').textContent}, low ${day.querySelector('.forecast-temperatures span').textContent}`);
  });
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const city = elements.input.value.trim();
  if (city) searchCity(city);
});

elements.unitToggle.addEventListener('click', () => {
  useFahrenheit = !useFahrenheit;
  elements.unitToggle.setAttribute('aria-label', `Switch to ${useFahrenheit ? 'Celsius' : 'Fahrenheit'}`);
  elements.unitToggle.classList.toggle('is-fahrenheit', useFahrenheit);
  if (latestWeather) loadWeather(latestWeather.data.latitude, latestWeather.data.longitude, latestWeather.placeName);
});

elements.locationButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('Location is not supported by this browser. Search for a city instead.', true);
    return;
  }
  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => loadWeather(coords.latitude, coords.longitude, 'Your location'),
    () => {
      setLoading(false);
      setStatus('Could not access your location. Check your browser permission or search for a city.', true);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
});

searchCity('London');
