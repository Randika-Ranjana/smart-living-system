const TOMORROW_API_KEY = 'in9sttyLKwHxRrfMTV1uAfSMNmFv9oH4';
let userLocation = null;
let lastApiCall = 0;
const API_CALL_INTERVAL = 1000; // 1 second between API calls

document.addEventListener('DOMContentLoaded', function() {
    // Check for saved location in localStorage
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        try {
            userLocation = JSON.parse(savedLocation);
            getWeatherData();
        } catch (e) {
            console.error('Error parsing saved location:', e);
            localStorage.removeItem('userLocation');
        }
    }

    // Event listeners for location buttons
    document.getElementById('allow-location').addEventListener('click', requestLocation);
    document.getElementById('manual-location').addEventListener('click', showManualLocationForm);
    document.getElementById('submit-location').addEventListener('click', submitManualLocation);
    document.getElementById('refresh-weather').addEventListener('click', refreshWeather);
});

function requestLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    type: 'coords'
                };
                localStorage.setItem('userLocation', JSON.stringify(userLocation));
                getWeatherData();
            },
            error => {
                console.error('Error getting location:', error);
                showError('Could not get your location. Please enter it manually.');
                showManualLocationForm();
            }
        );
    } else {
        showError('Geolocation is not supported by your browser.');
        showManualLocationForm();
    }
}

function showManualLocationForm() {
    document.getElementById('weather-permission').classList.add('hidden');
    document.getElementById('manual-location-form').classList.remove('hidden');
    document.getElementById('current-weather').classList.add('hidden');
}

function submitManualLocation() {
    const city = document.getElementById('city-input').value.trim();
    if (city) {
        userLocation = {
            city: city,
            type: 'city'
        };
        localStorage.setItem('userLocation', JSON.stringify(userLocation));
        getWeatherData();
    } else {
        showError('Please enter a city name');
    }
}

function refreshWeather() {
    if (userLocation) {
        getWeatherData();
    } else {
        document.getElementById('weather-permission').classList.remove('hidden');
        document.getElementById('manual-location-form').classList.add('hidden');
        document.getElementById('current-weather').classList.add('hidden');
    }
}

async function getWeatherData() {
    try {
        // Enforce rate limiting
        const now = Date.now();
        if (now - lastApiCall < API_CALL_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, API_CALL_INTERVAL - (now - lastApiCall)));
        }
        lastApiCall = Date.now();

        // Show loading state
        document.getElementById('weather-permission').classList.add('hidden');
        document.getElementById('manual-location-form').classList.add('hidden');
        document.getElementById('current-weather').classList.add('hidden');
        
        let url;
        if (userLocation.type === 'coords') {
            url = `https://api.tomorrow.io/v4/weather/realtime?location=${userLocation.lat},${userLocation.lon}&apikey=${TOMORROW_API_KEY}&units=metric`;
        } else {
            url = `https://api.tomorrow.io/v4/weather/realtime?location=${userLocation.city}&apikey=${TOMORROW_API_KEY}&units=metric`;
        }
        
        const response = await fetch(url);
        
        // Check if request was successful
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Too many requests. Please wait a moment and try again.');
            }
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Validate response structure
        validateWeatherData(data);
        
        // Update UI with weather data
        updateCurrentWeather(data);
        getHourlyForecast();
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError(error.message || 'Failed to fetch weather data. Please try again.');
        
        // Show appropriate UI based on error
        if (!userLocation) {
            document.getElementById('weather-permission').classList.remove('hidden');
        }
    }
}

function validateWeatherData(data) {
    if (!data || !data.data || !data.data.values) {
        throw new Error('Invalid weather data structure from API');
    }
    
    const requiredFields = ['temperature', 'humidity', 'windSpeed', 'uvIndex', 'temperatureApparent'];
    requiredFields.forEach(field => {
        if (typeof data.data.values[field] === 'undefined') {
            throw new Error(`Missing required weather field: ${field}`);
        }
    });
}

function updateCurrentWeather(data) {
    const current = data.data.values;
    const location = data.location?.name || 
                   (userLocation.city || `${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)}`);
    
    document.getElementById('current-location').textContent = location;
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    document.getElementById('current-temp').textContent = Math.round(current.temperature);
    document.getElementById('current-humidity').textContent = `${Math.round(current.humidity)}%`;
    document.getElementById('current-feels-like').textContent = `${Math.round(current.temperatureApparent)}°C`;
    document.getElementById('current-wind').textContent = `${Math.round(current.windSpeed * 3.6)} km/h`;
    document.getElementById('current-uv').textContent = current.uvIndex;
    document.getElementById('current-pressure').textContent = current.pressureSurfaceLevel ? Math.round(current.pressureSurfaceLevel) : 'N/A';
    
    // Set weather icon
    const icon = document.getElementById('current-weather-icon');
    const iconName = getWeatherIcon(current.weatherCode);
    icon.src = `images/icons/weather-icons/${iconName}.svg`;
    icon.alt = current.weatherCode;
    
    document.getElementById('current-weather').classList.remove('hidden');
}

async function getHourlyForecast() {
    try {
        // Enforce rate limiting
        const now = Date.now();
        if (now - lastApiCall < API_CALL_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, API_CALL_INTERVAL - (now - lastApiCall)));
        }
        lastApiCall = Date.now();

        let url;
        if (userLocation.type === 'coords') {
            url = `https://api.tomorrow.io/v4/weather/forecast?location=${userLocation.lat},${userLocation.lon}&apikey=${TOMORROW_API_KEY}&units=metric&timesteps=1h`;
        } else {
            url = `https://api.tomorrow.io/v4/weather/forecast?location=${userLocation.city}&apikey=${TOMORROW_API_KEY}&units=metric&timesteps=1h`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Hourly forecast request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data?.timelines?.hourly) {
            throw new Error('Invalid hourly forecast data structure');
        }
        
        updateHourlyForecast(data.timelines.hourly);
    } catch (error) {
        console.error('Error fetching hourly forecast:', error);
        showError('Could not load hourly forecast data');
    }
}

function updateHourlyForecast(hourlyData) {
    const container = document.getElementById('hourly-forecast');
    container.innerHTML = '';
    
    // Show next 12 hours
    const now = new Date();
    const next12Hours = hourlyData
        .filter(entry => new Date(entry.time) >= now)
        .slice(0, 12);
    
    next12Hours.forEach(entry => {
        const time = new Date(entry.time);
        const hour = time.getHours();
        const temp = Math.round(entry.values.temperature);
        
        const card = document.createElement('div');
        card.className = 'flex-shrink-0 bg-white bg-opacity-10 p-4 rounded-lg shadow-md text-center min-w-24 backdrop-filter backdrop-blur-sm';
        card.innerHTML = `
            <p class="font-medium">${hour}:00</p>
            <img src="images/icons/weather-icons/${getWeatherIcon(entry.values.weatherCode)}.svg" 
                 alt="${entry.values.weatherCode}" 
                 class="w-12 h-12 mx-auto my-2">
            <p class="text-xl font-semibold">${temp}°C</p>
        `;
        
        container.appendChild(card);
    });
}

function getWeatherIcon(weatherCode) {
    // Map the Tomorrow.io weather codes to icon names
    const code = parseInt(weatherCode);
    const isDay = new Date().getHours() > 6 && new Date().getHours() < 18;
    const daySuffix = isDay ? '_day' : '_night';
    
    // Clear/Sunny
    if (code === 1000) return 'clear' + daySuffix;
    if (code === 1100) return 'mostly_clear' + daySuffix;
    if (code === 1101) return 'partly_cloudy' + daySuffix;
    if (code === 1102) return 'mostly_cloudy';
    if (code === 1001) return 'cloudy';
    
    // Precipitation
    if (code === 4000) return 'drizzle';
    if (code === 4001) return 'rain';
    if (code >= 4200 && code < 5000) return 'rain_light';
    
    // Snow
    if (code === 5000 || code === 5001) return 'snow';
    if (code >= 5100 && code < 6000) return 'snow_light';
    
    // Freezing Rain
    if (code >= 6000 && code < 7000) return 'freezing_rain';
    
    // Ice Pellets
    if (code >= 7000 && code < 8000) return 'ice_pellets';
    
    // Thunderstorm
    if (code >= 8000) return 'thunderstorm';
    
    // Fog
    if (code >= 2000 && code < 3000) return 'fog';
    
    // Default fallback
    return 'clear' + daySuffix;
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'bg-red-500/80 text-white p-3 rounded-lg mb-4 text-center animate-fade-in-up';
    errorElement.textContent = message;
    
    const weatherContainer = document.getElementById('current-weather');
    weatherContainer.prepend(errorElement);
    weatherContainer.classList.remove('hidden');
    
    setTimeout(() => {
        errorElement.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => errorElement.remove(), 300);
    }, 5000);
}