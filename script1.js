// ======================================================
// SkyCast — Live Weather Dashboard
// This file fetches real weather data from free, no-key
// APIs (Open-Meteo) and shows it on the page.
// Every line below has a comment explaining what it does,
// written for someone who is new to JavaScript.
// ======================================================

// This grabs the search form element from the HTML so we can listen for submissions
const searchForm = document.getElementById('search-form');
// This grabs the text box where the user types a city name
const cityInput = document.getElementById('city-input');
// This grabs the "Near me" button that uses GPS location
const locateBtn = document.getElementById('locate-btn');

// This grabs the loading box so we can show/hide it
const loadingBox = document.getElementById('loading');
// This grabs the error box so we can show/hide it
const errorBox = document.getElementById('error');
// This grabs the text element inside the error box, so we can change its message
const errorMessage = document.getElementById('error-message');
// This grabs the whole dashboard section so we can show/hide it
const dashboard = document.getElementById('dashboard');

// This is a lookup table that turns Open-Meteo's numeric "weather codes"
// into a friendly emoji icon and a plain-English description.
// Using an object like this keeps our logic simple instead of many if/else lines.
const WEATHER_CODES = {
    0: { icon: '☀️', text: 'Clear Sky' },              // code 0 means totally clear sky
    1: { icon: '🌤️', text: 'Mostly Clear' },            // code 1 means mostly clear
    2: { icon: '⛅', text: 'Partly Cloudy' },            // code 2 means partly cloudy
    3: { icon: '☁️', text: 'Overcast' },                 // code 3 means fully cloudy
    45: { icon: '🌫️', text: 'Foggy' },                   // code 45 means fog
    48: { icon: '🌫️', text: 'Icy Fog' },                 // code 48 means depositing fog
    51: { icon: '🌦️', text: 'Light Drizzle' },           // code 51 means light drizzle
    53: { icon: '🌦️', text: 'Drizzle' },                 // code 53 means moderate drizzle
    55: { icon: '🌧️', text: 'Heavy Drizzle' },           // code 55 means dense drizzle
    61: { icon: '🌦️', text: 'Light Rain' },              // code 61 means slight rain
    63: { icon: '🌧️', text: 'Rain' },                    // code 63 means moderate rain
    65: { icon: '🌧️', text: 'Heavy Rain' },              // code 65 means heavy rain
    71: { icon: '🌨️', text: 'Light Snow' },              // code 71 means slight snow
    73: { icon: '❄️', text: 'Snow' },                    // code 73 means moderate snow
    75: { icon: '❄️', text: 'Heavy Snow' },              // code 75 means heavy snow
    80: { icon: '🌧️', text: 'Rain Showers' },            // code 80 means rain showers
    81: { icon: '🌧️', text: 'Heavy Showers' },           // code 81 means violent-ish showers
    95: { icon: '⛈️', text: 'Thunderstorm' },            // code 95 means thunderstorm
    96: { icon: '⛈️', text: 'Storm with Hail' },         // code 96 means thunderstorm with hail
};

// This is a small helper function that safely looks up a weather code,
// and falls back to a generic cloud icon if the code is not in our table above.
function getWeatherInfo(code) {
    return WEATHER_CODES[code] || { icon: '☁️', text: 'Unknown' }; // fallback keeps the app from crashing
}

// This turns a wind direction in degrees (0-360) into a compass label like "NE"
function degreesToCompass(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; // the 8 main compass points
    const index = Math.round(deg / 45) % 8;                          // divides the circle into 8 slices
    return directions[index];                                         // returns the matching label
}

// This turns a 24-hour "HH:MM" style time string into a friendly "H:MM AM/PM" format
function formatTime(isoString) {
    const date = new Date(isoString);                     // converts the text into a real Date object
    let hours = date.getHours();                           // gets the hour (0-23)
    const minutes = String(date.getMinutes()).padStart(2, '0'); // gets minutes and pads to 2 digits
    const suffix = hours >= 12 ? 'PM' : 'AM';               // decides AM or PM
    hours = hours % 12 || 12;                                // converts 0-23 hour into 1-12 hour
    return `${hours}:${minutes} ${suffix}`;                  // combines everything into one readable string
}

// This turns today's date into a friendly string like "Tuesday, Aug 6"
function formatToday() {
    const options = { weekday: 'long', month: 'short', day: 'numeric' }; // formatting rules we want
    return new Date().toLocaleDateString('en-US', options);               // builds the readable date string
}

// This decides which color and label to show for a given US Air Quality Index number
function getAqiStyle(aqi) {
    if (aqi <= 50) return { color: '#6BCB77', label: 'Good' };        // green = good air
    if (aqi <= 100) return { color: '#FFD93D', label: 'Moderate' };    // yellow = moderate air
    if (aqi <= 150) return { color: '#FFB347', label: 'Unhealthy (Sensitive)' }; // amber = caution
    return { color: '#FF6363', label: 'Unhealthy' };                   // red = unhealthy air
}

// This shows the loading spinner and hides the other two states
function showLoading() {
    loadingBox.classList.remove('hidden');  // reveals the loading box
    errorBox.classList.add('hidden');       // hides the error box
    dashboard.classList.add('hidden');      // hides the dashboard while we fetch new data
}

// This shows the error box with a custom message and hides the other two states
function showError(message) {
    errorMessage.textContent = message;    // updates the error text with our custom message
    loadingBox.classList.add('hidden');    // hides the loading spinner
    errorBox.classList.remove('hidden');   // reveals the error box
    dashboard.classList.add('hidden');     // hides the dashboard since we have no valid data
}

// This shows the dashboard and hides the other two states
function showDashboard() {
    loadingBox.classList.add('hidden'); // hides the loading spinner
    errorBox.classList.add('hidden');   // hides the error box
    dashboard.classList.remove('hidden'); // reveals the full dashboard
}

// This is the main function that looks up a city name and turns it into coordinates.
// It uses Open-Meteo's free geocoding API, which needs no API key at all.
async function geocodeCity(cityName) {
    // This builds the request URL, safely encoding the city name for the web
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    const response = await fetch(url);            // sends the request and waits for a reply
    if (!response.ok) throw new Error('Network error while searching city'); // catches server-side failures
    const data = await response.json();             // turns the reply into a usable JavaScript object
    if (!data.results || data.results.length === 0) {  // checks if the city was actually found
        throw new Error('City not found');               // stops here and lets the caller show an error
    }
    const place = data.results[0];                    // takes the best-matching result
    return {
        name: place.name,                                // the clean city name
        country: place.country || '',                    // the country name, if available
        latitude: place.latitude,                          // the geographic latitude
        longitude: place.longitude,                         // the geographic longitude
    };
}

// This fetches the actual weather + forecast data for a given latitude/longitude pair
async function fetchWeather(lat, lon) {
    // This builds the request URL asking for current conditions, daily forecast, and local timezone
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
        `&timezone=auto`;
    const response = await fetch(url);              // sends the request to Open-Meteo
    if (!response.ok) throw new Error('Network error while fetching weather'); // catches server errors
    return await response.json();                     // returns the parsed weather data
}

// This fetches the current Air Quality Index for a given latitude/longitude pair
async function fetchAirQuality(lat, lon) {
    // This builds the request URL asking for the US AQI value
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;
    const response = await fetch(url);          // sends the request to the air quality API
    if (!response.ok) throw new Error('Network error while fetching air quality'); // catches server errors
    return await response.json();                 // returns the parsed air quality data
}

// This takes all the fetched data and writes it onto the page (the "render" step)
function renderDashboard(place, weather, air) {
    const current = weather.current;                         // shortcut to the current-conditions object
    const daily = weather.daily;                               // shortcut to the multi-day forecast object
    const info = getWeatherInfo(current.weather_code);          // looks up the icon + text for today's code

    // ---- Fill in the hero card ----
    document.getElementById('hero-location').textContent =
        `${place.name}${place.country ? ', ' + place.country : ''}`; // shows "City, Country"
    document.getElementById('hero-date').textContent = formatToday(); // shows today's friendly date
    document.getElementById('hero-icon').textContent = info.icon;      // shows the big weather emoji
    document.getElementById('hero-temp').textContent = `${Math.round(current.temperature_2m)}°`; // shows rounded temp
    document.getElementById('hero-condition').textContent = info.text;  // shows the plain-English condition
    document.getElementById('hero-feels').textContent =
        `Feels like ${Math.round(current.apparent_temperature)}°`;       // shows the "feels like" temperature
    document.getElementById('hero-highlow').textContent =
        `${Math.round(daily.temperature_2m_max[0])}° / ${Math.round(daily.temperature_2m_min[0])}°`; // today's high/low
    document.getElementById('hero-humidity-quick').textContent =
        `${current.relative_humidity_2m}%`;                                // quick humidity readout in the hero card

    // This changes the hero card's background gradient depending on the weather, for a "mood" effect
    // (these colors are picked to match the same photo used for the page background: gold, navy, and teal)
    const heroCard = document.getElementById('hero-card');
    if (current.weather_code >= 95) {
        heroCard.style.background = 'linear-gradient(135deg, #16233E 0%, #2E6E86 100%)'; // stormy = deep navy
    } else if (current.weather_code >= 61 && current.weather_code <= 82) {
        heroCard.style.background = 'linear-gradient(135deg, #2E6E86 0%, #3FA9C9 100%)'; // rainy = navy-teal
    } else if (current.weather_code >= 71 && current.weather_code <= 77) {
        heroCard.style.background = 'linear-gradient(135deg, #3FA9C9 0%, #16233E 100%)'; // snowy = icy teal-navy
    } else if (current.weather_code === 0 || current.weather_code === 1) {
        heroCard.style.background = 'linear-gradient(135deg, #E0954F 0%, #F2B368 100%)'; // clear = warm sunset gold
    } else {
        heroCard.style.background = 'linear-gradient(135deg, #2E6E86 0%, #E0954F 100%)'; // cloudy/other = teal-gold blend
    }

    // ---- Fill in the wind card ----
    document.getElementById('wind-speed').textContent = `${Math.round(current.wind_speed_10m)} km/h`; // rounded wind speed
    document.getElementById('wind-direction-text').textContent =
        `Direction: ${degreesToCompass(current.wind_direction_10m)}`;                                    // compass label
    // This rotates the arrow icon so it visually points the way the wind blows
    document.getElementById('wind-arrow').style.transform = `rotate(${current.wind_direction_10m}deg)`;

    // ---- Fill in the humidity card ----
    document.getElementById('humidity-value').textContent = `${current.relative_humidity_2m}%`; // humidity percent text
    document.getElementById('humidity-bar').style.width = `${current.relative_humidity_2m}%`;     // bar visually fills to match

    // ---- Fill in the sunrise/sunset card ----
    document.getElementById('sunrise-value').textContent = formatTime(daily.sunrise[0]); // today's sunrise time
    document.getElementById('sunset-value').textContent = formatTime(daily.sunset[0]);     // today's sunset time

    // ---- Fill in the air quality card ----
    const aqiValue = air.current && air.current.us_aqi != null ? Math.round(air.current.us_aqi) : null; // safely reads AQI
    const aqiBadge = document.getElementById('aqi-badge');       // grabs the circular badge element
    const aqiLabel = document.getElementById('aqi-label');        // grabs the text label under the badge
    if (aqiValue === null) {
        document.getElementById('aqi-number').textContent = '--'; // shows placeholder if AQI is unavailable
        aqiLabel.textContent = 'Data unavailable';                  // explains why it's blank
    } else {
        const style = getAqiStyle(aqiValue);           // looks up the right color and label for this AQI value
        document.getElementById('aqi-number').textContent = aqiValue; // shows the actual AQI number
        aqiBadge.style.background = style.color;                        // colors the badge to match the AQI level
        aqiLabel.textContent = style.label;                               // shows the plain-English air quality label
    }

    // ---- Build the multi-day forecast strip ----
    const forecastStrip = document.getElementById('forecast-strip'); // grabs the container for day cards
    forecastStrip.innerHTML = '';                                      // clears out any previous forecast cards first
    for (let i = 0; i < daily.time.length; i++) {                       // loops through every day the API gave us
        const dayInfo = getWeatherInfo(daily.weather_code[i]);            // looks up icon/text for that day
        const dayName = new Date(daily.time[i]).toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Mon"

        const dayCard = document.createElement('div');    // creates a new empty card element
        dayCard.className = 'forecast-day';                 // gives it our forecast-day styling class
        // This fills the card with the day name, icon, and high/low temperatures
        dayCard.innerHTML = `
            <p class="forecast-day-name">${i === 0 ? 'Today' : dayName}</p>
            <p class="forecast-day-icon">${dayInfo.icon}</p>
            <p class="forecast-day-temps">
                <span class="high">${Math.round(daily.temperature_2m_max[i])}°</span> /
                ${Math.round(daily.temperature_2m_min[i])}°
            </p>
        `;
        forecastStrip.appendChild(dayCard); // adds the finished card onto the page
    }

    showDashboard(); // finally, reveal the completed dashboard to the user
}

// This is the main "controller" function: given a place object, it fetches
// everything needed and renders it, handling any errors along the way.
async function loadWeatherForPlace(place) {
    try {
        showLoading(); // show the spinner while we work
        // These two requests run at the same time to save loading time
        const [weather, air] = await Promise.all([
            fetchWeather(place.latitude, place.longitude),      // gets temperature, wind, forecast, etc
            fetchAirQuality(place.latitude, place.longitude),    // gets the air quality index
        ]);
        renderDashboard(place, weather, air); // paints everything onto the page
    } catch (err) {
        console.error(err);                                          // logs the real error for developers
        showError('Something went wrong while fetching the weather. Please try again.'); // friendly message for users
    }
}

// This runs when the user searches for a city by name
async function handleCitySearch(cityName) {
    try {
        showLoading();                          // show the spinner immediately
        const place = await geocodeCity(cityName); // converts the typed city name into coordinates
        await loadWeatherForPlace(place);           // fetches and displays weather for that place
    } catch (err) {
        console.error(err);                                                  // logs the real error for developers
        showError(`We could not find "${cityName}". Please check the spelling and try again.`); // friendly message
    }
}

// This runs when the user clicks "Near me" and uses their device's GPS
function handleLocateMe() {
    if (!navigator.geolocation) {                       // checks if this browser even supports geolocation
        showError('Your browser does not support location services.'); // friendly fallback message
        return;                                            // stops here since we cannot continue
    }
    showLoading(); // show the spinner while we wait for GPS permission and a fix
    navigator.geolocation.getCurrentPosition(
        async (position) => {                                    // this runs if the user allows location access
            const place = {
                name: 'Your Location',                              // generic label since we don't reverse-geocode
                country: '',                                          // no country name available from GPS alone
                latitude: position.coords.latitude,                    // the device's real latitude
                longitude: position.coords.longitude,                    // the device's real longitude
            };
            await loadWeatherForPlace(place); // fetches and displays weather for the user's real location
        },
        () => {                                                    // this runs if the user denies or GPS fails
            showError('We could not access your location. Please allow location access or search a city instead.');
        }
    );
}

// ---- Event listeners: these connect user actions to the functions above ----

// This listens for the search form being submitted (Enter key or clicking Search)
searchForm.addEventListener('submit', (event) => {
    event.preventDefault();               // stops the page from refreshing, which forms normally do
    const cityName = cityInput.value.trim(); // reads the typed text and removes extra spaces
    if (cityName) {                          // only searches if the box isn't empty
        handleCitySearch(cityName);            // runs our search logic
    }
});

// This listens for clicks on the "Near me" button
locateBtn.addEventListener('click', handleLocateMe);

// This runs automatically the very first time the page loads.
// We intentionally do NOT auto-search any city here — the dashboard
// stays empty until the user actually searches a city or taps "Near me".
// (loading/error/dashboard all start hidden already in the HTML.)