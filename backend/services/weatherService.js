// services/WeatherService.js

const axios = require('axios');
const logger = require('../utils/logger');

class WeatherService {
    constructor() {
        this.apiKey = process.env.TOMORROW_API_KEY;
        this.opencageKey = process.env.OPENCAGE_API_KEY;
        this.baseUrl = 'https://api.tomorrow.io/v4';

        if (!this.apiKey || !this.opencageKey) {
            throw new Error('Both TOMORROW_API_KEY and OPENCAGE_API_KEY are required');
        }
    }

    async getWeatherData(location) {
        try {
            logger.info(`Fetching weather data for location: ${location}`);

            const isCoordinates = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location);
            let coords = isCoordinates
                ? location
                : await this.geocodeWithOpenCage(location);

            const [currentWeather, forecast] = await Promise.all([
                this.getCurrentWeather(coords),
                this.getForecast(coords)
            ]);

            const processedData = this.processWeatherData(currentWeather, forecast, location, coords);

            logger.info(`Successfully fetched weather data for: ${processedData.location.name}`);
            return processedData;

        } catch (error) {
            logger.error('Error fetching weather data:', {
                location,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async geocodeWithOpenCage(cityName) {
        try {
            const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
                params: {
                    q: cityName,
                    key: this.opencageKey,
                    limit: 1
                },
                timeout: 10000
            });

            const data = response.data;

            if (!data || !data.results || data.results.length === 0) {
                throw new Error(`Location "${cityName}" not found`);
            }

            const result = data.results[0].geometry;
            return `${result.lat},${result.lng}`;

        } catch (error) {
            throw new Error(`OpenCage geocoding error: ${error.message}`);
        }
    }

    async getCurrentWeather(coordinates) {
        const response = await axios.get(`${this.baseUrl}/weather/realtime`, {
            params: {
                location: coordinates,
                apikey: this.apiKey,
                fields: [
                    'temperature',
                    'temperatureApparent',
                    'humidity',
                    'windSpeed',
                    'weatherCode',
                    'precipitationIntensity',
                    'visibility',
                    'pressureSeaLevel'
                ].join(',')
            },
            timeout: 10000
        });

        logger.debug('Current weather API response', response.data);
        return response.data;
    }

    async getForecast(coordinates) {
        const response = await axios.get(`${this.baseUrl}/weather/forecast`, {
            params: {
                location: coordinates,
                apikey: this.apiKey,
                timesteps: 'hourly',
                fields: [
                    'temperature',
                    'temperatureApparent',
                    'humidity',
                    'windSpeed',
                    'weatherCode',
                    'precipitationIntensity'
                ].join(','),
                endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            },
            timeout: 15000
        });

        logger.debug('Forecast API response', response.data);
        return response.data;
    }

    processWeatherData(currentWeather, forecast, originalLocation, coordinates) {
        const locationInfo = {
            name: this.formatLocationName(originalLocation),
            coordinates: {
                lat: parseFloat(coordinates.split(',')[0]),
                lng: parseFloat(coordinates.split(',')[1])
            }
        };

        // Validate currentWeather data exists
        if (!currentWeather || !currentWeather.data || !currentWeather.data.values) {
            logger.error('Invalid current weather data received', currentWeather);
            throw new Error(`Invalid current weather data: ${JSON.stringify(currentWeather)}`);
        }

        // Handle different forecast data formats from Tomorrow.io API
        let forecastIntervals;
        
        if (forecast.data && forecast.data.timelines && forecast.data.timelines[0] && forecast.data.timelines[0].intervals) {
            // Old format: { data: { timelines: [{ intervals: [...] }] } }
            forecastIntervals = forecast.data.timelines[0].intervals;
        } else if (forecast.timelines && forecast.timelines.hourly) {
            // New format: { timelines: { hourly: [...] } }
            forecastIntervals = forecast.timelines.hourly.map(item => ({
                startTime: item.time,
                values: item.values
            }));
        } else {
            logger.error('Invalid forecast data structure received', {
                hasData: !!forecast.data,
                hasTimelines: !!(forecast.data && forecast.data.timelines),
                hasDirectTimelines: !!forecast.timelines,
                hasHourly: !!(forecast.timelines && forecast.timelines.hourly),
                forecast: forecast
            });
            throw new Error(`Invalid forecast data structure. Expected either { data: { timelines: [...] } } or { timelines: { hourly: [...] } }`);
        }

        const current = this.processCurrentWeather(currentWeather.data);
        const hourlyForecast = this.processForecast(forecastIntervals);

        return {
            location: locationInfo,
            current,
            forecast: hourlyForecast
        };
    }

    formatLocationName(query) {
        if (/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(query)) {
            return `${query}`;
        }

        return query.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    processCurrentWeather(data) {
        const values = data.values;
        const time = new Date(data.time);
        const isDay = this.isDayTime(time);

        return {
            temperature: values.temperature,
            feelsLike: values.temperatureApparent,
            humidity: values.humidity,
            windSpeed: values.windSpeed,
            weatherCode: values.weatherCode,
            condition: this.getWeatherCondition(values.weatherCode),
            isDay,
            time: time.toISOString(),
            precipitation: values.precipitationIntensity || 0,
            visibility: values.visibility || null,
            pressure: values.pressureSeaLevel || null
        };
    }

    processForecast(intervals) {
        return intervals.slice(0, 12).map(interval => {
            const time = new Date(interval.startTime);
            const values = interval.values;
            const isDay = this.isDayTime(time);

            return {
                time: time.toISOString(),
                temperature: values.temperature,
                feelsLike: values.temperatureApparent,
                humidity: values.humidity,
                windSpeed: values.windSpeed,
                weatherCode: values.weatherCode,
                condition: this.getWeatherCondition(values.weatherCode),
                isDay,
                precipitation: values.precipitationIntensity || 0
            };
        });
    }

    isDayTime(time) {
        const hour = time.getHours();
        return hour >= 6 && hour < 18;
    }

    getWeatherCondition(weatherCode) {
        const conditions = {
            0: 'Unknown',
            1000: 'Clear',
            1100: 'Mostly Clear',
            1101: 'Partly Cloudy',
            1102: 'Mostly Cloudy',
            1001: 'Cloudy',
            2000: 'Fog',
            2100: 'Light Fog',
            4000: 'Drizzle',
            4001: 'Rain',
            4200: 'Light Rain',
            4201: 'Heavy Rain',
            5000: 'Snow',
            5001: 'Flurries',
            5100: 'Light Snow',
            5101: 'Heavy Snow',
            6000: 'Freezing Drizzle',
            6001: 'Freezing Rain',
            6200: 'Light Freezing Rain',
            6201: 'Heavy Freezing Rain',
            7000: 'Ice Pellets',
            7101: 'Heavy Ice Pellets',
            7102: 'Light Ice Pellets',
            8000: 'Thunderstorm'
        };

        return conditions[weatherCode] || 'Unknown';
    }
}

module.exports = new WeatherService();