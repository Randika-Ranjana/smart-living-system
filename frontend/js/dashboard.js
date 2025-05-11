import { isAuthenticated, getAuthToken, logout, makeAuthenticatedRequest } from './auth.js';
import { loadWeatherData, displayWeather } from './weather.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Set user email in header
    const userEmail = sessionStorage.getItem('userEmail');
    if (userEmail) {
        document.getElementById('user-email').textContent = userEmail;
        document.getElementById('user-email').classList.remove('hidden');
    }

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Initialize dashboard
    initDashboard();
    initWeather();
    initTemperatureChart();
});

async function initDashboard() {
    try {
        // Load user devices
        const response = await makeAuthenticatedRequest('/api/devices');
        const devices = await response.json();

        // Hide loading indicator
        document.getElementById('devices-loading').classList.add('hidden');

        // Display devices
        const devicesContainer = document.querySelector('main .grid');
        devices.forEach(device => {
            const deviceCard = createDeviceCard(device);
            devicesContainer.appendChild(deviceCard);
        });
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        document.getElementById('devices-loading').innerHTML = `
            <p class="text-red-500">Error loading devices. Please try again.</p>
        `;
    }
}

function createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-lg p-6';
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <h3 class="text-xl font-bold">${device.name || 'Heating Device'}</h3>
            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${device.id}</span>
        </div>
        <div class="flex items-center justify-between mb-4">
            <div>
                <p class="text-gray-600 text-sm">Current Temperature</p>
                <p class="text-3xl font-bold">${device.currentTemp} <span class="text-xl">°C</span></p>
            </div>
            <div class="h-12 w-12 rounded-full flex items-center justify-center ${device.state ? 'bg-red-500' : 'bg-gray-300'}">
                <span class="text-white text-xl">${device.state ? 'ON' : 'OFF'}</span>
            </div>
        </div>
        <div class="mb-4">
            <p class="text-gray-600 text-sm mb-2">Desired Temperature</p>
            <div class="flex items-center">
                <input type="range" min="10" max="30" value="${device.desiredTemp}" 
                    class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                <span class="ml-3 font-bold w-8 text-center">${device.desiredTemp}°</span>
            </div>
        </div>
        <div class="text-sm text-gray-500">
            Last updated: ${new Date(device.lastUpdated).toLocaleTimeString()}
        </div>
    `;

    // Add event listener to temperature slider
    const slider = card.querySelector('input[type="range"]');
    const valueDisplay = card.querySelector('span.font-bold');
    
    slider.addEventListener('input', () => {
        valueDisplay.textContent = `${slider.value}°`;
    });

    slider.addEventListener('change', async () => {
        try {
            await makeAuthenticatedRequest(`/api/device/${device.id}/update`, {
                method: 'POST',
                body: JSON.stringify({
                    desiredTemp: parseFloat(slider.value)
                })
            });
        } catch (error) {
            console.error('Error updating temperature:', error);
        }
    });

    return card;
}

async function initWeather() {
    try {
        const weatherData = await loadWeatherData({ city: 'London' }); // Default city or use user's location
        displayWeather(weatherData, 'dashboard-');
    } catch (error) {
        console.error('Error loading weather for dashboard:', error);
    }
}

function initTemperatureChart() {
    const ctx = document.getElementById('temperature-chart').getContext('2d');
    
    // Mock data - replace with actual API data
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const tempData = Array.from({ length: 24 }, () => Math.floor(Math.random() * 10) + 15);
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: tempData,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    min: 10,
                    max: 30,
                    ticks: {
                        stepSize: 2
                    }
                }
            }
        }
    });

    // Time range buttons
    document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            document.querySelectorAll('.time-range-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-200');
            });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-gray-200');

            // Update chart data based on range
            const range = btn.dataset.range;
            let newLabels, newData;

            if (range === '24h') {
                newLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
                newData = Array.from({ length: 24 }, () => Math.floor(Math.random() * 10) + 15);
            } else if (range === '7d') {
                newLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                newData = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10) + 15);
            } else {
                newLabels = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
                newData = Array.from({ length: 30 }, () => Math.floor(Math.random() * 10) + 15);
            }

            chart.data.labels = newLabels;
            chart.data.datasets[0].data = newData;
            chart.update();
        });
    });
}