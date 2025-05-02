#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define DHTPIN 4
#define DHTTYPE DHT22
#define LED_PIN 26

// Wi-Fi credentials
const char* ssid = "Randika";
const char* password = "987654321";

// Backend URLs - 🔁 Replace with actual public URL when hosted online
const char* postUrl = "http://192.168.183.212:4000/esp32-data";
const char* getUrl = "http://192.168.183.212:4000/desired-temp";

// Device ID
const char* deviceId = "esp32_devkit_01";

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
DHT dht(DHTPIN, DHTTYPE);

// Setup I2C bus (TCA9548A Multiplexer)
void TCA9548A(uint8_t bus) {
  Wire.beginTransmission(0x70);
  Wire.write(1 << bus);
  Wire.endTransmission();
}

void setupDisplay(uint8_t bus) {
  TCA9548A(bus);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.print("SSD1306 failed on bus: ");
    Serial.println(bus);
    while (true); // Stop further execution
  }
  display.clearDisplay();
  display.display();
}

void updateDisplay1() {
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

void updateDisplay2(float temp, float humidity, bool heatingActive) {
  TCA9548A(1);
  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Temp:");

  drawThermometerIcon(display, 0, 10);
  display.setCursor(20, 13);
  display.print(temp);
  display.println(" C");

  display.setCursor(0, 30);
  display.println("Humidity:");

  drawWaterDropIcon(display, 0, 40);
  display.setCursor(20, 43);
  display.print(humidity);
  display.println(" %");

  if (heatingActive) {
    display.setCursor(0, 55);
    display.print("Heating Active");
  }

  display.display();
}

void drawThermometerIcon(Adafruit_SSD1306 &display, int x, int y) {
  display.fillCircle(x + 4, y + 10, 4, SSD1306_WHITE);
  display.drawRect(x + 2, y, 4, 10, SSD1306_WHITE);
}

void drawWaterDropIcon(Adafruit_SSD1306 &display, int x, int y) {
  display.fillTriangle(x + 3, y, x, y + 8, x + 6, y + 8, SSD1306_WHITE);
  display.fillCircle(x + 3, y + 8, 3, SSD1306_WHITE);
}

void setupWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" Connected!");
}

void sendTempData(float temp, float humidity) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(postUrl);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"deviceId\": \"" + String(deviceId) + "\", \"temperature\": " + String(temp, 2) + ", \"humidity\": " + String(humidity, 2) + "}";
    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("POST Success: ");
      Serial.println(response);
    } else {
      Serial.print("POST failed. Code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi not connected. Cannot send data.");
  }
}

float getDesiredTemp() {
  float desiredTemp = 25.0;
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(getUrl);
    int httpCode = http.GET();

    if (httpCode == 200) {
      String response = http.getString();
      desiredTemp = response.toFloat();
      Serial.println("GET Success. Desired Temp: " + String(desiredTemp));
    } else {
      Serial.print("GET failed. Code: ");
      Serial.println(httpCode);
    }

    http.end();
  } else {
    Serial.println("WiFi not connected. Cannot fetch desired temp.");
  }

  return desiredTemp;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  dht.begin();
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  setupWiFi();
  setupDisplay(0);
  setupDisplay(1);
  updateDisplay1();
}

void loop() {
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();

  if (isnan(temp) || isnan(humidity)) {
    Serial.println("Sensor read failed.");
    delay(30000);
    return;
  }

  float desiredTemp = getDesiredTemp();
  sendTempData(temp, humidity);

  bool heatingActive = false;
  if (desiredTemp != 25.0) {
    heatingActive = (temp < desiredTemp);
  } else {
    heatingActive = (temp > 25.0);
  }

  digitalWrite(LED_PIN, heatingActive ? HIGH : LOW);
  updateDisplay2(temp, humidity, heatingActive);

  delay(30000);  // Wait 30 sec before next cycle
}
