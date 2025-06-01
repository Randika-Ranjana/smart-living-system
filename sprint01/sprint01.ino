#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Configuration Constants
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define DHTPIN 4
#define DHTTYPE DHT22
#define NORMAL_AC_PIN 25
#define FALLBACK_AC_PIN 26
#define POST_INTERVAL 30000
#define WIFI_TIMEOUT 15000
#define HTTP_TIMEOUT 10000

// Display Animation Constants
#define SCREEN_TRANSITION_TIME 3000  // 3 seconds per screen
#define ANIMATION_SPEED 100         // Animation frame update speed
#define SCROLL_SPEED 2              // Text scroll speed
#define FADE_STEPS 8               // Number of fade steps

// Wi-Fi credentials
const char* ssid = "Randika";
const char* password = "987654321";

// Backend configuration
const char* backendBaseUrl = "http://56.228.70.167:4000";
const char* deviceId = "Room-01";

// OLED and Sensor Objects
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
DHT dht(DHTPIN, DHTTYPE);

// System State Enum
enum SystemState {
  AUTO_MODE,
  MANUAL_ON,
  MANUAL_OFF,
  ERROR_STATE,
  FALLBACK_MODE
};

// Display Screen Enum
enum DisplayScreen {
  SPLASH_SCREEN,
  MAIN_STATUS_SCREEN,
  SENSOR_DETAIL_SCREEN,
  NETWORK_STATUS_SCREEN,
  AC_CONTROL_SCREEN
};

// System Variables
SystemState currentState = AUTO_MODE;
float desiredTemp = 25.0;
bool dbConnected = false;
unsigned long lastPostTime = 0;
unsigned long lastControlFetchTime = 0;
bool settingsChanged = false;
bool useFallbackMode = false;

// Display Management Variables
DisplayScreen currentScreen = SPLASH_SCREEN;
unsigned long lastScreenChange = 0;
unsigned long lastAnimationUpdate = 0;
int animationFrame = 0;
int scrollOffset = 0;
bool fadeDirection = true;
int fadeLevel = 0;
float currentTemp = 0.0;
float currentHumidity = 0.0;

// Display Initialization with Animation
void setupDisplay() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
    while (true);
  }
  
  // Boot animation
  bootAnimation();
}

// Boot Animation Sequence
void bootAnimation() {
  display.clearDisplay();
  
  // Fade in "The Architects" with expanding circle effect
  for (int radius = 0; radius <= 30; radius += 2) {
    display.clearDisplay();
    display.drawCircle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, radius, SSD1306_WHITE);
    display.display();
    delay(50);
  }
  
  delay(200);
  
  // Text fade in
  for (int fade = 0; fade <= 255; fade += 32) {
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(30, 15);
    display.println("The");
    display.setCursor(5, 35);
    display.println("Architects");
    display.display();
    delay(100);
  }
  
  delay(2000);
  
  // Loading bar animation
  showLoadingBar();
  
  currentScreen = MAIN_STATUS_SCREEN;
  lastScreenChange = millis();
}

// Loading Bar Animation
void showLoadingBar() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(35, 20);
  display.println("Initializing...");
  
  // Draw loading bar frame
  display.drawRect(20, 35, 88, 10, SSD1306_WHITE);
  
  for (int progress = 0; progress <= 84; progress += 2) {
    display.fillRect(22, 37, progress, 6, SSD1306_WHITE);
    display.display();
    delay(30);
  }
  
  display.setCursor(40, 50);
  display.println("Ready!");
  display.display();
  delay(1000);
}

// Main Display Update Manager
void updateDisplayManager(float temp, float humidity, bool acActive) {
  currentTemp = temp;
  currentHumidity = humidity;
  
  unsigned long currentTime = millis();
  
  // Handle screen transitions
  if (currentTime - lastScreenChange >= SCREEN_TRANSITION_TIME) {
    transitionToNextScreen();
    lastScreenChange = currentTime;
  }
  
  // Handle animations
  if (currentTime - lastAnimationUpdate >= ANIMATION_SPEED) {
    updateAnimations();
    lastAnimationUpdate = currentTime;
  }
  
  // Render current screen
  renderCurrentScreen(temp, humidity, acActive);
}

// Screen Transition with Slide Effect
void transitionToNextScreen() {
  // Slide out current screen
  for (int x = 0; x <= SCREEN_WIDTH; x += 16) {
    display.clearDisplay();
    renderCurrentScreen(currentTemp, currentHumidity, 
                       digitalRead(useFallbackMode ? FALLBACK_AC_PIN : NORMAL_AC_PIN));
    
    // Create slide effect by drawing a black rectangle
    display.fillRect(x, 0, SCREEN_WIDTH - x, SCREEN_HEIGHT, SSD1306_BLACK);
    display.display();
    delay(20);
  }
  
  // Move to next screen
  switch (currentScreen) {
    case SPLASH_SCREEN:
      currentScreen = MAIN_STATUS_SCREEN;
      break;
    case MAIN_STATUS_SCREEN:
      currentScreen = SENSOR_DETAIL_SCREEN;
      break;
    case SENSOR_DETAIL_SCREEN:
      currentScreen = NETWORK_STATUS_SCREEN;
      break;
    case NETWORK_STATUS_SCREEN:
      currentScreen = AC_CONTROL_SCREEN;
      break;
    case AC_CONTROL_SCREEN:
      currentScreen = MAIN_STATUS_SCREEN;
      break;
  }
  
  // Slide in new screen
  for (int x = SCREEN_WIDTH; x >= 0; x -= 16) {
    display.clearDisplay();
    renderCurrentScreen(currentTemp, currentHumidity,
                       digitalRead(useFallbackMode ? FALLBACK_AC_PIN : NORMAL_AC_PIN));
    
    display.fillRect(0, 0, x, SCREEN_HEIGHT, SSD1306_BLACK);
    display.display();
    delay(20);
  }
}

// Update Animation Variables
void updateAnimations() {
  animationFrame = (animationFrame + 1) % 60;
  scrollOffset = (scrollOffset + SCROLL_SPEED) % 200;
  
  if (fadeDirection) {
    fadeLevel++;
    if (fadeLevel >= FADE_STEPS) fadeDirection = false;
  } else {
    fadeLevel--;
    if (fadeLevel <= 0) fadeDirection = true;
  }
}

// Render Current Screen
void renderCurrentScreen(float temp, float humidity, bool acActive) {
  display.clearDisplay();
  
  switch (currentScreen) {
    case MAIN_STATUS_SCREEN:
      renderMainStatusScreen(temp, humidity, acActive);
      break;
    case SENSOR_DETAIL_SCREEN:
      renderSensorDetailScreen(temp, humidity);
      break;
    case NETWORK_STATUS_SCREEN:
      renderNetworkStatusScreen();
      break;
    case AC_CONTROL_SCREEN:
      renderACControlScreen(temp, acActive);
      break;
  }
  
  display.display();
}

// Main Status Screen with Animated Elements
void renderMainStatusScreen(float temp, float humidity, bool acActive) {
  // Animated header
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 0);
  display.println("The Architects");
  
  // Pulsing separator line
  int lineY = 10 + (fadeLevel % 3);
  display.drawLine(0, lineY, SCREEN_WIDTH, lineY, SSD1306_WHITE);
  
  // Temperature with thermometer animation
  display.setCursor(5, 15);
  display.print("Temp: ");
  display.print(temp, 1);
  display.println("C");
  drawAnimatedThermometer(100, 15, temp);
  
  // Humidity with water drop animation
  display.setCursor(5, 30);
  display.print("Hum: ");
  display.print(humidity, 1);
  display.println("%");
  drawAnimatedWaterDrop(110, 30);
  
  // Status with blinking indicator
  display.setCursor(5, 45);
  if (useFallbackMode) {
    display.print("FALLBACK:");
    if (animationFrame % 20 < 10) {
      display.print(acActive ? "AC ON" : "AC OFF");
    }
  } else {
    display.print("AUTO:");
    if (animationFrame % 20 < 10) {
      display.print(acActive ? "ON" : "OFF");
    }
  }
  
  // Connection status with animated icon
  display.setCursor(5, 55);
  display.print("DB:");
  if (dbConnected) {
    if (animationFrame % 30 < 15) {
      display.print("CONNECTED");
    } else {
      display.print("SYNC");
    }
  } else {
    if (animationFrame % 10 < 5) {
      display.print("ERROR");
    }
  }
}

// Sensor Detail Screen with Graphs
void renderSensorDetailScreen(float temp, float humidity) {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(25, 0);
  display.println("Sensor Details");
  display.drawLine(0, 10, SCREEN_WIDTH, 10, SSD1306_WHITE);
  
  // Temperature bar graph
  display.setCursor(0, 15);
  display.print("T:");
  display.print(temp, 1);
  int tempBarWidth = map(temp, 0, 50, 0, 80);
  display.drawRect(25, 15, 82, 8, SSD1306_WHITE);
  display.fillRect(26, 16, tempBarWidth, 6, SSD1306_WHITE);
  
  // Humidity bar graph
  display.setCursor(0, 30);
  display.print("H:");
  display.print(humidity, 1);
  int humBarWidth = map(humidity, 0, 100, 0, 80);
  display.drawRect(25, 30, 82, 8, SSD1306_WHITE);
  display.fillRect(26, 31, humBarWidth, 6, SSD1306_WHITE);
  
  // Desired temperature
  display.setCursor(0, 45);
  display.print("Target: ");
  display.print(desiredTemp, 1);
  display.println("C");
  
  // Progress indicator
  int dotPos = (animationFrame / 10) % 4;
  for (int i = 0; i < 4; i++) {
    if (i == dotPos) {
      display.fillCircle(50 + i * 8, 55, 2, SSD1306_WHITE);
    } else {
      display.drawCircle(50 + i * 8, 55, 2, SSD1306_WHITE);
    }
  }
}

// Network Status Screen
void renderNetworkStatusScreen() {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 0);
  display.println("Network Status");
  display.drawLine(0, 10, SCREEN_WIDTH, 10, SSD1306_WHITE);
  
  // WiFi Status with signal strength animation
  display.setCursor(0, 15);
  display.print("WiFi: ");
  if (WiFi.status() == WL_CONNECTED) {
    display.println("Connected");
    drawWiFiSignal(90, 15);
  } else {
    display.println("Disconnected");
  }
  
  // IP Address (scrolling if too long)
  display.setCursor(0, 25);
  display.print("IP: ");
  if (WiFi.status() == WL_CONNECTED) {
    String ip = WiFi.localIP().toString();
    display.println(ip.c_str());
  } else {
    display.println("N/A");
  }
  
  // Backend connection
  display.setCursor(0, 35);
  display.print("Backend: ");
  if (dbConnected) {
    display.println("Online");
    // Pulsing dot
    if (animationFrame % 20 < 10) {
      display.fillCircle(120, 38, 2, SSD1306_WHITE);
    }
  } else {
    display.println("Offline");
    // Blinking X
    if (animationFrame % 10 < 5) {
      display.drawLine(115, 35, 125, 45, SSD1306_WHITE);
      display.drawLine(125, 35, 115, 45, SSD1306_WHITE);
    }
  }
  
  // Device ID
  display.setCursor(0, 45);
  display.print("Device: ");
  display.println(deviceId);
  
  // Data transmission indicator
  display.setCursor(0, 55);
  display.print("Data TX: ");
  for (int i = 0; i < 3; i++) {
    if ((animationFrame + i * 10) % 30 < 15) {
      display.fillRect(70 + i * 8, 55, 4, 6, SSD1306_WHITE);
    } else {
      display.drawRect(70 + i * 8, 55, 4, 6, SSD1306_WHITE);
    }
  }
}

// AC Control Screen
void renderACControlScreen(float temp, bool acActive) {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(25, 0);
  display.println("AC Control");
  display.drawLine(0, 10, SCREEN_WIDTH, 10, SSD1306_WHITE);
  
  // Current temperature display
  display.setTextSize(2);
  display.setCursor(0, 15);
  display.print(temp, 1);
  display.setTextSize(1);
  display.setCursor(60, 25);
  display.println("C");
  
  // Target temperature
  display.setCursor(80, 15);
  display.print("Target:");
  display.setCursor(80, 25);
  display.print(desiredTemp, 1);
  display.println("C");
  
  // AC Status with animated icon
  display.setCursor(0, 35);
  display.print("AC Status: ");
  if (acActive) {
    display.println("ON");
    drawAnimatedAC(90, 35, true);
  } else {
    display.println("OFF");
    drawAnimatedAC(90, 35, false);
  }
  
  // Mode display
  display.setCursor(0, 45);
  display.print("Mode: ");
  switch (currentState) {
    case AUTO_MODE: display.println("AUTO"); break;
    case MANUAL_ON: display.println("MANUAL ON"); break;
    case MANUAL_OFF: display.println("MANUAL OFF"); break;
    case ERROR_STATE: display.println("ERROR"); break;
    case FALLBACK_MODE: display.println("FALLBACK"); break;
  }
  
  // Temperature difference indicator
  display.setCursor(0, 55);
  float diff = temp - desiredTemp;
  display.print("Diff: ");
  if (diff > 0) display.print("+");
  display.print(diff, 1);
  display.println("C");
}

// Animated Thermometer
void drawAnimatedThermometer(int x, int y, float temp) {
  // Thermometer body
  display.drawRect(x, y, 6, 12, SSD1306_WHITE);
  display.fillCircle(x + 3, y + 14, 4, SSD1306_WHITE);
  
  // Animated mercury level
  int mercuryHeight = map(temp, 0, 50, 0, 10);
  for (int i = 0; i < mercuryHeight; i++) {
    if ((animationFrame + i) % 8 < 4) {
      display.drawPixel(x + 2, y + 10 - i, SSD1306_WHITE);
      display.drawPixel(x + 3, y + 10 - i, SSD1306_WHITE);
      display.drawPixel(x + 4, y + 10 - i, SSD1306_WHITE);
    }
  }
}

// Animated Water Drop
void drawAnimatedWaterDrop(int x, int y) {
  // Water drop shape with animation
  int dropSize = 3 + (fadeLevel % 2);
  display.fillTriangle(x + dropSize, y, x, y + dropSize * 2, x + dropSize * 2, y + dropSize * 2, SSD1306_WHITE);
  display.fillCircle(x + dropSize, y + dropSize * 2, dropSize, SSD1306_WHITE);
}

// WiFi Signal Strength Animation
void drawWiFiSignal(int x, int y) {
  for (int i = 0; i < 4; i++) {
    int barHeight = (i + 1) * 2;
    if ((animationFrame + i * 5) % 20 < 10) {
      display.fillRect(x + i * 3, y + 8 - barHeight, 2, barHeight, SSD1306_WHITE);
    } else {
      display.drawRect(x + i * 3, y + 8 - barHeight, 2, barHeight, SSD1306_WHITE);
    }
  }
}

// Animated AC Unit
void drawAnimatedAC(int x, int y, bool active) {
  // AC unit body
  display.drawRect(x, y, 12, 8, SSD1306_WHITE);
  
  if (active) {
    // Animated air flow lines
    for (int i = 0; i < 3; i++) {
      if ((animationFrame + i * 3) % 12 < 6) {
        display.drawLine(x + 13, y + 2 + i * 2, x + 18, y + 2 + i * 2, SSD1306_WHITE);
      }
    }
  }
}

// WiFi Connection (existing function - kept as is)
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  WiFi.disconnect(true);
  delay(1000);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");
  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startTime < WIFI_TIMEOUT) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("\nConnection failed");
  return false;
}

// Fetch control settings from backend (existing function - kept as is)
bool fetchControlSettings() {
  if (!connectWiFi()) {
    dbConnected = false;
    return false;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/api/devices/control?deviceId=" + String(deviceId);

  http.setReuse(false);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  http.setTimeout(HTTP_TIMEOUT);
  http.setConnectTimeout(5000);

  if (!http.begin(url)) {
    Serial.println("HTTP begin failed");
    return false;
  }

  int httpCode = http.GET();
  bool success = false;

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();

    if (payload.length() == 0 || payload.length() > 500) {
      Serial.println("Invalid payload length");
      http.end();
      return false;
    }

    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);

    if (!error && doc.containsKey("mode")) {
      float newTemp = doc["desiredTemp"] | 25.0;
      SystemState newState = AUTO_MODE;

      if (strcmp(doc["mode"], "manual") == 0) {
        newState = strcmp(doc["power"], "on") == 0 ? MANUAL_ON : MANUAL_OFF;
      }

      if (newTemp != desiredTemp || newState != currentState) {
        desiredTemp = newTemp;
        currentState = newState;
        settingsChanged = true;
        Serial.printf("New settings applied: Mode=%d, Temp=%.1f\n", currentState, desiredTemp);
      }
      success = true;
      dbConnected = true;
      useFallbackMode = false;
    } else {
      Serial.print("JSON error: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.printf("HTTP error: %s\n", http.errorToString(httpCode).c_str());
    dbConnected = false;
    useFallbackMode = true;
  }

  http.end();
  return success;
}

// Send sensor data to backend (existing function - kept as is)
bool sendSensorData(float temp, float humidity) {
  if (!connectWiFi()) {
    dbConnected = false;
    useFallbackMode = true;
    return false;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/device-data";

  http.setReuse(false);
  http.setTimeout(HTTP_TIMEOUT);
  http.setConnectTimeout(5000);

  if (!http.begin(url)) {
    Serial.println("HTTP begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(256);
  doc["deviceId"] = deviceId;
  doc["temperature"] = temp;
  doc["humidity"] = humidity;
  doc["acState"] = digitalRead(NORMAL_AC_PIN);
  doc["desiredTemp"] = desiredTemp;
  doc["fallbackMode"] = useFallbackMode;

  String payload;
  serializeJson(doc, payload);

  Serial.println("Sending payload: " + payload);

  int httpCode = http.POST(payload);
  bool success = (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED);

  if (success) {
    dbConnected = true;
    useFallbackMode = false;
    String response = http.getString();
    Serial.println("Server response: " + response);
  } else {
    Serial.printf("HTTP error: %s\n", http.errorToString(httpCode).c_str());
    dbConnected = false;
    useFallbackMode = true;
  }

  http.end();
  return success;
}

// Control AC based on mode (existing function - kept as is)
void controlAC(float currentTemp) {
  bool acShouldBeOn = false;

  if (useFallbackMode || !dbConnected) {
    acShouldBeOn = (currentTemp > 25.0);
    digitalWrite(NORMAL_AC_PIN, LOW);
    digitalWrite(FALLBACK_AC_PIN, acShouldBeOn ? HIGH : LOW);
  } else {
    switch(currentState) {
      case AUTO_MODE:
        acShouldBeOn = (currentTemp > desiredTemp + 0.5);
        break;
      case MANUAL_ON:
        acShouldBeOn = true;
        break;
      case MANUAL_OFF:
      case ERROR_STATE:
        acShouldBeOn = false;
        break;
    }
    digitalWrite(FALLBACK_AC_PIN, LOW);
    digitalWrite(NORMAL_AC_PIN, acShouldBeOn ? HIGH : LOW);
  }
}

// System Initialization
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.printf("Initial free heap: %d\n", ESP.getFreeHeap());

  Wire.begin();
  dht.begin();

  pinMode(NORMAL_AC_PIN, OUTPUT);
  pinMode(FALLBACK_AC_PIN, OUTPUT);
  digitalWrite(NORMAL_AC_PIN, LOW);
  digitalWrite(FALLBACK_AC_PIN, LOW);

  setupDisplay();
  connectWiFi();
}

// Main Loop
void loop() {
  unsigned long currentTime = millis();

  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temp) || isnan(humidity)) {
    Serial.println("Sensor read error");
    currentState = ERROR_STATE;
    digitalWrite(NORMAL_AC_PIN, LOW);
    digitalWrite(FALLBACK_AC_PIN, LOW);
    
    // Show error screen
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(20, 10);
    display.println("SENSOR");
    display.setCursor(30, 30);
    display.println("ERROR");
    display.display();
    
    delay(POST_INTERVAL);
    return;
  }

  if (currentTime - lastControlFetchTime >= POST_INTERVAL * 2 || lastControlFetchTime == 0) {
    Serial.println("Fetching control settings...");
    if (!fetchControlSettings()) {
      useFallbackMode = true;
    }
    lastControlFetchTime = currentTime;
  }

  controlAC(temp);

  // Update display with new animation system
  updateDisplayManager(temp, humidity, 
                      digitalRead(useFallbackMode ? FALLBACK_AC_PIN : NORMAL_AC_PIN));

  if (currentTime - lastPostTime >= POST_INTERVAL || lastPostTime == 0) {
    if (!sendSensorData(temp, humidity)) {
      useFallbackMode = true;
    }
    lastPostTime = currentTime;
  }

  delay(100); // Reduced delay for smoother animations
}