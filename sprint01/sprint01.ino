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
#define NORMAL_AC_PIN 25    // Primary AC control (when backend is connected)
#define FALLBACK_AC_PIN 26  // Fallback AC control (when backend fails)
#define POST_INTERVAL 30000  // 30 seconds
#define WIFI_TIMEOUT 15000   // 15 seconds
#define HTTP_TIMEOUT 10000   // 10 seconds

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

// System Variables
SystemState currentState = AUTO_MODE;
float desiredTemp = 25.0;  // Default temperature
bool dbConnected = false;
unsigned long lastPostTime = 0;
unsigned long lastControlFetchTime = 0;
bool settingsChanged = false;
bool useFallbackMode = false;

// I2C Multiplexer Function
void TCA9548A(uint8_t bus) {
  Wire.beginTransmission(0x70);
  Wire.write(1 << bus);
  Wire.endTransmission();
}

// Display Initialization
void setupDisplay(uint8_t bus) {
  TCA9548A(bus);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.printf("SSD1306 failed on bus: %d\n", bus);
    while (true);
  }
  display.clearDisplay();
  display.display();
}

// WiFi Connection
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

// Fetch control settings from backend
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

// Send sensor data to backend
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

// Update main display
void updateMainDisplay() {
  TCA9548A(0);
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(30, 10);
  display.println("The");
  display.setCursor(5, 38);
  display.println("Architects");
  display.display();
}

// Update sensor display
void updateSensorDisplay(float temp, float humidity, bool acActive) {
  TCA9548A(1);
  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Temp:");
  display.setCursor(20, 13);
  display.print(temp, 1);
  display.println(" C");
  drawThermometerIcon(0, 10);

  display.setCursor(0, 30);
  display.println("Humidity:");
  display.setCursor(20, 43);
  display.print(humidity, 1);
  display.println(" %");
  drawWaterDropIcon(0, 40);

  display.setCursor(0, 55);
  if (useFallbackMode) {
    display.print("FALLBACK:");
    display.print(acActive ? "AC ON" : "AC OFF");
  } else {
    switch(currentState) {
      case AUTO_MODE: 
        display.print("AUTO:");
        display.print(acActive ? "AC ON" : "AC OFF");
        break;
      case MANUAL_ON: display.print("MANUAL:ON"); break;
      case MANUAL_OFF: display.print("MANUAL:OFF"); break;
      case ERROR_STATE: display.print("ERROR"); break;
    }
  }

  display.setCursor(90, 55);
  display.print(dbConnected ? "DB:OK" : "DB:ERR");

  display.display();
}

// Draw thermometer icon
void drawThermometerIcon(int x, int y) {
  display.fillCircle(x + 4, y + 10, 4, SSD1306_WHITE);
  display.drawRect(x + 2, y, 4, 10, SSD1306_WHITE);
}

// Draw water drop icon
void drawWaterDropIcon(int x, int y) {
  display.fillTriangle(x + 3, y, x, y + 8, x + 6, y + 8, SSD1306_WHITE);
  display.fillCircle(x + 3, y + 8, 3, SSD1306_WHITE);
}

// Control AC based on mode
void controlAC(float currentTemp) {
  bool acShouldBeOn = false;
  
  if (useFallbackMode || !dbConnected) {
    // Fallback mode - use pin 26 and simple 25°C threshold
    acShouldBeOn = (currentTemp > 25.0);
    digitalWrite(NORMAL_AC_PIN, LOW);  // Ensure normal pin is off
    digitalWrite(FALLBACK_AC_PIN, acShouldBeOn ? HIGH : LOW);
  } else {
    // Normal operation - use pin 25 and backend settings
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
    digitalWrite(FALLBACK_AC_PIN, LOW);  // Ensure fallback pin is off
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

  setupDisplay(0);
  setupDisplay(1);
  updateMainDisplay();

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
    updateSensorDisplay(0, 0, false);
    delay(POST_INTERVAL);
    return;
  }

  // Update control settings periodically
  if (currentTime - lastControlFetchTime >= POST_INTERVAL * 2 || lastControlFetchTime == 0) {
    Serial.println("Fetching control settings...");
    if (!fetchControlSettings()) {
      useFallbackMode = true;
    }
    lastControlFetchTime = currentTime;
  }

  // Control AC based on current mode
  controlAC(temp);

  // Update display if settings changed
  if (settingsChanged || currentTime - lastPostTime >= POST_INTERVAL) {
    updateSensorDisplay(temp, humidity, 
                       digitalRead(useFallbackMode ? FALLBACK_AC_PIN : NORMAL_AC_PIN));
    settingsChanged = false;
  }

  // Post data to server
  if (currentTime - lastPostTime >= POST_INTERVAL || lastPostTime == 0) {
    if (!sendSensorData(temp, humidity)) {
      useFallbackMode = true;
    }
    lastPostTime = currentTime;
  }

  delay(1000);
}