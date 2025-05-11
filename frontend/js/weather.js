// Weather forecast functionality (used on both home and dashboard)
const WEATHER_API_KEY = '5e076f97741998513ad62894ec5459c4';

export async function loadWeatherData(location) {
    try {
        let url;
        if (location.coords) {
            const { latitude, longitude } = location.coords;
            url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`;
        } else if (location.city) {
            url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location.city)}&units=metric&appid=${WEATHER_API_KEY}`;
        } else {
            throw new Error('Invalid location data');
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Weather data not available');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}

export function displayWeather(data, prefix = '') {
    if (!data || !data.list || data.list.length === 0) {
        throw new Error('Invalid weather data');
    }

    // Current weather (first item in list)
    const current = data.list[0];
    const city = data.city.name;
    const country = data.city.country;

    // Update current weather display
    if (document.getElementById(`${prefix}weather-location`)) {
        document.getElementById(`${prefix}weather-location`).textContent = `${city}, ${country}`;
        document.getElementById(`${prefix}weather-date`).textContent = new Date(current.dt * 1000).toLocaleDateString();
        document.getElementById(`${prefix}weather-temp`).textContent = Math.round(current.main.temp);
        
        const weatherIcon = getWeatherIcon(current.weather[0].id);
        document.getElementById(`${prefix}weather-icon`).textContent = weatherIcon;
    }

    // Update hourly forecast
    const hourlyContainer = document.getElementById(`${prefix}hourly-forecast`);
    if (hourlyContainer) {
        hourlyContainer.querySelector('div').innerHTML = '';
        
        // Get next 12 hours (3-hour intervals)
        const next12Hours = data.list.slice(0, 4);
        
        next12Hours.forEach(hour => {
            const hourElement = document.createElement('div');
            hourElement.className = 'flex flex-col items-center min-w-max';
            
            const time = new Date(hour.dt * 1000);
            const hourString = time.getHours().toString().padStart(2, '0') + ':00';
            
            const weatherIcon = getWeatherIcon(hour.weather[0].id);
            
            hourElement.innerHTML = `
                <span class="text-sm font-medium">${hourString}</span>
                <span class="text-3xl my-1">${weatherIcon}</span>
                <span class="text-lg font-bold">${Math.round(hour.main.temp)}°</span>
                <span class="text-xs text-gray-500">${hour.main.humidity}%</span>
            `;
            
            hourlyContainer.querySelector('div').appendChild(hourElement);
        });
    }
}

function getWeatherIcon(weatherId) {
    // Map OpenWeatherMap weather codes to emojis
    if (weatherId >= 200 && weatherId < 300) {
        return '⛈️'; // Thunderstorm
    } else if (weatherId >= 300 && weatherId < 400) {
        return '🌧️'; // Drizzle
    } else if (weatherId >= 500 && weatherId < 600) {
        return '🌧️'; // Rain
    } else if (weatherId >= 600 && weatherId < 700) {
        return '❄️'; // Snow
    } else if (weatherId >= 700 && weatherId < 800) {
        return '🌫️'; // Atmosphere (fog, haze, etc.)
    } else if (weatherId === 800) {
        return '☀️'; // Clear
    } else if (weatherId > 800 && weatherId < 900) {
        return '☁️'; // Clouds
    } else {
        return '🌈'; // Default
    }
}

export function setupWeather() {
    const weatherContainer = document.getElementById('weather-container');
    if (!weatherContainer) return;

    const loadingElement = document.getElementById('weather-loading');
    const contentElement = document.getElementById('weather-content');
    const errorElement = document.getElementById('weather-error');

    function showError(message) {
        loadingElement.classList.add('hidden');
        contentElement.classList.add('hidden');
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }

    function showContent() {
        loadingElement.classList.add('hidden');
        errorElement.classList.add('hidden');
        contentElement.classList.remove('hidden');
    }

    function getLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    position => resolve({ coords: position.coords }),
                    error => {
                        console.warn('Geolocation error:', error);
                        const city = prompt('Please enter your city name:');
                        if (city) {
                            resolve({ city });
                        } else {
                            reject(new Error('Location access denied and no city provided'));
                        }
                    }
                );
            } else {
                const city = prompt('Please enter your city name:');
                if (city) {
                    resolve({ city });
                } else {
                    reject(new Error('Geolocation not supported and no city provided'));
                }
            }
        });
    }

    getLocation()
        .then(location => {
            return loadWeatherData(location);
        })
        .then(weatherData => {
            displayWeather(weatherData);
            showContent();
        })
        .catch(error => {
            console.error('Weather initialization error:', error);
            showError('Could not load weather data. Please try again later.');
        });
}

// Initialize weather on home page
if (document.getElementById('weather-container')) {
    document.addEventListener('DOMContentLoaded', setupWeather);
}