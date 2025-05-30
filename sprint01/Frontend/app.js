const API_BASE = 'http://56.228.70.167:4000'; // Your EC2 public IP
let currentDeviceId = '';
let chart;
let isDragging = false;
let currentTemp = 20;
let previousTemp = null;
let previousHumidity = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  initializeCircularSlider();
  setupEventListeners();
  updateSliderProgress();
  
  // Add SVG gradient definition for the circular slider
  const svg = document.querySelector('.slider-svg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.setAttribute('id', 'tempGradient');
  gradient.innerHTML = `
    <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
    <stop offset="50%" style="stop-color:#10b981;stop-opacity:1" />
    <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
  `;
  defs.appendChild(gradient);
  svg.insertBefore(defs, svg.firstChild);
});

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.getElementById('notifications').appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideInRight 0.3s ease-out reverse';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Enhanced loading states
function setLoadingState(elementId, isLoading) {
  const element = document.getElementById(elementId);
  if (isLoading) {
    element.classList.add('loading');
  } else {
    element.classList.remove('loading');
  }
}

// Load device data with enhanced UX
async function loadDeviceData() {
  currentDeviceId = document.getElementById('deviceId').value.trim();
  if (!currentDeviceId) {
    showNotification("Please enter a device ID", 'error');
    return;
  }

  setLoadingState('loadBtn', true);
  
  try {
    // Load device data
    const response = await fetch(`${API_BASE}/api/devices/data?deviceId=${currentDeviceId}`);
    if (!response.ok) throw new Error('Device data fetch failed');
    
    const data = await response.json();
    
    // Update sensor display
    if (data.sensorData) {
      updateSensorDisplay(data.sensorData);
    }
    
    // Update desired temperature
    if (data.controlSettings) {
      updateDesiredTempDisplay(parseFloat(data.controlSettings.desiredTemp));
    }
    
    // Load chart
    await loadChart();
    
    showNotification(`Connected to device: ${currentDeviceId}`, 'success');
    
  } catch (error) {
    console.error('Error loading device data:', error);
    showNotification('Failed to load device data', 'error');
  } finally {
    setLoadingState('loadBtn', false);
  }
}

// Update sensor display with animations and trends
function updateSensorDisplay(data) {
  const tempElement = document.getElementById('temperature');
  const humidityElement = document.getElementById('humidity');
  const tempTrendElement = document.getElementById('tempTrend');
  const humidityTrendElement = document.getElementById('humidityTrend');
  
  const newTemp = data.temperature ? parseFloat(data.temperature.toFixed(1)) : null;
  const newHumidity = data.humidity ? parseFloat(data.humidity.toFixed(1)) : null;
  
  // Animate temperature change
  if (newTemp !== null) {
    animateValue(tempElement, tempElement.textContent === '--' ? newTemp : parseFloat(tempElement.textContent), newTemp);
    
    // Show trend
    if (previousTemp !== null) {
      const tempDiff = newTemp - previousTemp;
      if (Math.abs(tempDiff) > 0.1) {
        tempTrendElement.textContent = tempDiff > 0 ? `↗ +${tempDiff.toFixed(1)}°` : `↘ ${tempDiff.toFixed(1)}°`;
        tempTrendElement.style.color = tempDiff > 0 ? '#ef4444' : '#3b82f6';
      } else {
        tempTrendElement.textContent = '→ Stable';
        tempTrendElement.style.color = '#10b981';
      }
    }
    previousTemp = newTemp;
  } else {
    tempElement.textContent = '--';
  }
  
  // Animate humidity change
  if (newHumidity !== null) {
    animateValue(humidityElement, humidityElement.textContent === '--' ? newHumidity : parseFloat(humidityElement.textContent), newHumidity);
    
    // Show trend
    if (previousHumidity !== null) {
      const humidityDiff = newHumidity - previousHumidity;
      if (Math.abs(humidityDiff) > 1) {
        humidityTrendElement.textContent = humidityDiff > 0 ? `↗ +${humidityDiff.toFixed(1)}%` : `↘ ${humidityDiff.toFixed(1)}%`;
        humidityTrendElement.style.color = humidityDiff > 0 ? '#3b82f6' : '#ef4444';
      } else {
        humidityTrendElement.textContent = '→ Stable';
        humidityTrendElement.style.color = '#10b981';
      }
    }
    previousHumidity = newHumidity;
  } else {
    humidityElement.textContent = '--';
  }
}

// Animate number changes
function animateValue(element, start, end, duration = 1000) {
  const startTime = performance.now();
  const difference = end - start;
  
  function updateValue(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = start + (difference * easeOut);
    
    element.textContent = current.toFixed(1);
    
    if (progress < 1) {
      requestAnimationFrame(updateValue);
    }
  }
  
  requestAnimationFrame(updateValue);
}

// Update desired temperature display
function updateDesiredTempDisplay(temp) {
  currentTemp = temp;
  document.getElementById('desiredTemp').value = temp;
  document.getElementById('desiredTempDisplay').textContent = temp.toFixed(1);
  updateSliderProgress();
  updateHandlePosition();
}

// Update desired temperature
async function updateDesiredTemp() {
  const desiredTemp = parseFloat(document.getElementById('desiredTemp').value);
  if (isNaN(desiredTemp) || desiredTemp < 5 || desiredTemp > 35) {
    showNotification("Enter a valid temperature between 5°C and 35°C", 'error');
    return;
  }

  if (!currentDeviceId) {
    showNotification("Please connect to a device first", 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/devices/control`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        deviceId: currentDeviceId, 
        desiredTemp,
        mode: 'auto',
        power: 'on'
      })
    });
    
    if (!response.ok) throw new Error('Update failed');
    
    const result = await response.json();
    if (result.success) {
      showNotification("Temperature updated successfully", 'success');
      currentTemp = desiredTemp;
      updateDesiredTempDisplay(desiredTemp);
    } else {
      throw new Error('Update failed');
    }
    
  } catch (error) {
    console.error('Error updating temperature:', error);
    showNotification('Failed to update temperature', 'error');
  }
}

// Circular slider functionality
function initializeCircularSlider() {
  const slider = document.querySelector('.circular-slider');
  const handle = document.getElementById('sliderHandle');
  
  slider.addEventListener('mousedown', startDrag);
  slider.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('mousemove', drag);
  document.addEventListener('touchmove', drag, { passive: false });
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchend', endDrag);
  
  updateHandlePosition();
}

function startDrag(e) {
  e.preventDefault();
  isDragging = true;
  updateTempFromPosition(e);
}

function drag(e) {
  if (!isDragging) return;
  e.preventDefault();
  updateTempFromPosition(e);
}

function endDrag() {
  isDragging = false;
}

function updateTempFromPosition(e) {
  const slider = document.querySelector('.circular-slider');
  const rect = slider.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  let clientX, clientY;
  if (e.type.includes('touch')) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  
  const angle = Math.atan2(clientY - centerY, clientX - centerX);
  let normalizedAngle = angle + Math.PI / 2;
  if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
  
  // Convert angle to temperature (5°C to 35°C range)
  const tempRange = 30; // 35 - 5
  const temp = 5 + (normalizedAngle / (2 * Math.PI)) * tempRange;
  const clampedTemp = Math.max(5, Math.min(35, temp));
  
  currentTemp = Math.round(clampedTemp * 2) / 2; // Round to nearest 0.5
  updateDesiredTempDisplay(currentTemp);
}

function updateHandlePosition() {
  const handle = document.getElementById('sliderHandle');
  const tempRange = 30; // 35 - 5
  const normalizedTemp = (currentTemp - 5) / tempRange;
  const angle = normalizedTemp * 2 * Math.PI - Math.PI / 2;
  
  const radius = 120;
  const x = 140 + radius * Math.cos(angle) - 12; // -12 to center the handle
  const y = 140 + radius * Math.sin(angle) - 12;
  
  handle.style.left = `${x}px`;
  handle.style.top = `${y}px`;
}

function updateSliderProgress() {
  const progressCircle = document.getElementById('progressCircle');
  const tempRange = 30; // 35 - 5
  const normalizedTemp = (currentTemp - 5) / tempRange;
  const circumference = 2 * Math.PI * 120; // 120 is the radius
  const offset = circumference - (normalizedTemp * circumference);
  
  progressCircle.style.strokeDashoffset = offset;
}

// Temperature adjustment functions
function adjustTemp(delta) {
  const newTemp = Math.max(5, Math.min(35, currentTemp + delta));
  currentTemp = newTemp;
  updateDesiredTempDisplay(currentTemp);
}

// Chart loading with enhanced UX
async function loadChart() {
  if (!currentDeviceId) return;
  
  const chartLoading = document.getElementById('chartLoading');
  const chartCanvas = document.getElementById('historyChart');
  const period = document.getElementById('historyPeriod').value;
  
  chartLoading.style.display = 'block';
  chartCanvas.style.opacity = '0.3';
  
  try {
    const response = await fetch(`${API_BASE}/api/devices/history?deviceId=${currentDeviceId}&period=${period}`);
    if (!response.ok) throw new Error('Chart data fetch failed');
    
    const data = await response.json();
    renderChart(data, period);
    
  } catch (error) {
    console.error('Error loading chart:', error);
    showNotification('Failed to load chart data', 'error');
  } finally {
    chartLoading.style.display = 'none';
    chartCanvas.style.opacity = '1';
  }
}

function renderChart(data, period) {
  const ctx = document.getElementById('historyChart').getContext('2d');
  
  if (chart) {
    chart.destroy();
  }
  
  const labels = data.map(entry => entry.label);
  const temps = data.map(entry => parseFloat(entry.temperature));
  const hums = data.map(entry => parseFloat(entry.humidity));
  
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: temps,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 8,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        },
        {
          label: 'Humidity (%)',
          data: hums,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 8,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              size: 14,
              weight: 500
            },
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        title: {
          display: true,
          text: `Sensor History (${period.charAt(0).toUpperCase() + period.slice(1)})`,
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 16,
            weight: 600
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          titleColor: 'white',
          bodyColor: 'white',
          cornerRadius: 8,
          displayColors: true
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              size: 12
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              size: 12
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  });
}

// Quick mode functions
function setEcoMode() {
  updateSystemMode(18, 'Eco mode activated - Temperature set to 18°C');
}

function setComfortMode() {
  updateSystemMode(22, 'Comfort mode activated - Temperature set to 22°C');
}

function setAwayMode() {
  updateSystemMode(16, 'Away mode activated - Temperature set to 16°C');
}

async function updateSystemMode(temp, message) {
  if (!currentDeviceId) {
    showNotification("Please connect to a device first", 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/devices/control`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        deviceId: currentDeviceId, 
        desiredTemp: temp,
        mode: 'auto',
        power: 'on'
      })
    });
    
    if (!response.ok) throw new Error('Update failed');
    
    const result = await response.json();
    if (result.success) {
      showNotification(message, 'success');
      currentTemp = temp;
      updateDesiredTempDisplay(temp);
    } else {
      throw new Error('Update failed');
    }
    
  } catch (error) {
    console.error('Error updating mode:', error);
    showNotification('Failed to update mode', 'error');
  }
}

// Setup additional event listeners
function setupEventListeners() {
  // Enter key support for device ID input
  document.getElementById('deviceId').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      loadDeviceData();
    }
  });
  
  // Enter key support for desired temp input
  document.getElementById('desiredTemp').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      updateDesiredTemp();
    }
  });
  
  // Update display when typing in temp input
  document.getElementById('desiredTemp').addEventListener('input', function(e) {
    const temp = parseFloat(e.target.value);
    if (!isNaN(temp) && temp >= 5 && temp <= 35) {
      currentTemp = temp;
      document.getElementById('desiredTempDisplay').textContent = temp.toFixed(1);
      updateSliderProgress();
      updateHandlePosition();
    }
  });
  
  // Auto-refresh data every 30 seconds if device is connected
  setInterval(() => {
    if (currentDeviceId) {
      loadDeviceData();
    }
  }, 30000);
}

// Error handling for network issues
window.addEventListener('online', () => {
  showNotification('Connection restored', 'success');
});

window.addEventListener('offline', () => {
  showNotification('Connection lost - Working offline', 'error');
});