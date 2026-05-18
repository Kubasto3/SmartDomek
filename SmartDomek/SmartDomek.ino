#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFiS3.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
 
// =========================
//  WiFi konfiguracja
// =========================
char ssid[] = "router";
char pass[] = "qwerty1234";
 
WiFiServer server(80);
 
// adres serwera Flask
const char* serverHost = "192.168.0.10";
const int   serverPort = 5000;
const char* apiKey     = "klucz";
const int userId       = 1;
 
// =========================
//  CZUJNIKI
// =========================
#define ONE_WIRE_BUS 2
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
 
Adafruit_BME280 bme;
 
const int sensorPin = A0;
 
// =========================
// Piny sterujące
// =========================
const int fanPin = 3;
const int led1Pin = 4;
const int led2Pin = 5;
const int buttonUpPin = 8;
const int buttonDownPin = 9;
const int heaterPin = 10;
 
// =========================
// Sterowanie
// =========================
float tempZadana = 27.0;
bool heaterON = false;
 
// =========================
// PID
// =========================
double Kp = 40;
double Ki = 20;
double Kd = 10;
 
double pidIntegral = 0.0;
double pidPrevError = 0.0;
 
unsigned long lastPidTime = 0;
const unsigned long sampleTimeMs = 1000;

double output;
 
// =========================
// Wysyłanie danych
// =========================
unsigned long lastSend = 0;
const unsigned long sendInterval = 10000;
 
// =========================
// Funkcje akcji
// =========================
void heaterOnFunc()  { heaterON = true; }
void heaterOffFunc() { heaterON = false; }
void incTempFunc()   { tempZadana++; }
void decTempFunc()   { tempZadana--; }
 
// =========================
// Parsowanie HTTP
// =========================
String readRequestLine(WiFiClient &c) {
  String req = "";
  unsigned long t0 = millis();
 
  while (c.connected() && millis() - t0 < 1000) {
    if (c.available()) {
      char ch = c.read();
      req += ch;
      if (ch == '\n') break;
    }
  }
  return req;
}
 
String extractPath(const String &req) {
  int sp1 = req.indexOf(' ');
  int sp2 = req.indexOf(' ', sp1 + 1);
  if (sp1 == -1 || sp2 == -1) return "";
  return req.substring(sp1 + 1, sp2);
}
 
// =========================
// Obsługa endpointów Arduino
// =========================
void handleEndpoint(WiFiClient &client, const String &path) {
  
  if (path == "/heater/on") {
    heaterOnFunc();
  }
  else if (path == "/heater/off") {
    heaterOffFunc();
  }
  else if (path == "/temp/increase") {
    incTempFunc();
  }
  else if (path == "/temp/decrease") {
    decTempFunc();
  }
  else {
    client.println("HTTP/1.1 404 Not Found");
    client.println("Content-Type: application/json\r\n");
    client.println("{\"error\": \"unknown endpoint\"}");
    return;
  }
 
  // odpowiedź OK
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: application/json\r\n");
  client.println("{\"status\""ok\"}");
}
 
void handleHttp() {
  WiFiClient client = server.available();
  if (!client) return;
 
  String reqLine = readRequestLine(client);
  if (reqLine.length() == 0) { client.stop(); return; }
 
  String path = extractPath(reqLine);
 
  handleEndpoint(client, path); 
  client.stop();
}
 
// =========================
// Wysyłanie pomiarów do Flask
// =========================
void sendToFlask(float tin, float tout, float humidity, float pressure, int light, bool heater) {
 
  if (WiFi.status() != WL_CONNECTED) return;
 
  WiFiClient client;
  if (!client.connect(serverHost, serverPort)) return;
 
  String json = "{";
  json += "\"temp_inside\":"   + String(tin, 2) + ",";
  json += "\"temp_outside\":"  + String(tout, 2) + ",";
  json += "\"heater_state\":"  + String(heater ? "true":"false") + ",";
  json += "\"set_temperature\":"+ String(tempZadana) + ",";
  json += "\"light_intensity\":"+ String(light) + ",";
  json += "\"humidity\":"      + String(humidity,2) + ",";
  json += "\"pressure\":"      + String(pressure / 100.0F, 2) + ",";
  json += "\"user_id\":"       + String(userId);
  json += "}";
 
  client.println("POST /api/measurements HTTP/1.1");
  client.print("Host: "); client.println(serverHost);
  client.println("Content-Type: application/json");
  client.print("Content-Length: "); client.println(json.length());
  client.print("X-API-KEY: "); client.println(apiKey);
  client.println();
  client.println(json);
 
  client.stop();
}
 
// =========================
// SETUP
// =========================
void setup() {
  Serial.begin(115200);
 
  sensors.begin();
  bme.begin(0x76);
 
  pinMode(fanPin, OUTPUT);
  pinMode(led1Pin, OUTPUT);
  pinMode(led2Pin, OUTPUT);
  pinMode(buttonUpPin, INPUT_PULLUP);
  pinMode(buttonDownPin, INPUT_PULLUP);
  pinMode(heaterPin, OUTPUT);
 
  while (WiFi.begin(ssid, pass) != WL_CONNECTED) {
    delay(2000);
  }
 
  Serial.print("Arduino IP: ");
  Serial.println(WiFi.localIP());
 
  server.begin();
}
 
// =========================
// LOOP (nieblokujący)
// =========================
void loop() {
 
  // 1) Obsługa komend Flask (natychmiastowa)
  handleHttp();
 
  // 2) Odczyt czujników
  sensors.requestTemperatures();
  float temp_in  = sensors.getTempCByIndex(0);
  float temp_out = bme.readTemperature();
  float hum      = bme.readHumidity();
  float press    = bme.readPressure();
  int light      = analogRead(sensorPin);
 
  // 3) Obsługa przycisków
  if (digitalRead(buttonUpPin) == LOW)  { tempZadana += 1; delay(60); }
  if (digitalRead(buttonDownPin) == LOW){ tempZadana -= 1; delay(60); }
 
  // 4) PID
  // unsigned long now = millis();
  // if (now - lastPidTime >= sampleTimeMs) {
  //   lastPidTime = now;
 
  //   double error = tempZadana - temp_in;
  //   pidIntegral += error;
  //   double deriv = error - pidPrevError;
 
  //   output = Kp * error + Ki * pidIntegral + Kd * deriv;
  //   if(heaterON == 1){
  //     output = constrain(output, 0, 255);
  //   } else {
  //     output = constrain(0, 0, 255);
  //   }
  //   analogWrite(heaterPin, (int)output);
  //   pidPrevError = error;
  // }
    unsigned long now = millis();
  if (now - lastPidTime >= sampleTimeMs) {
    lastPidTime = now;

    const float hyst1 = 0; 
    const float hyst2 = 0;
    static bool heatState = false;   // pamięta stan grzania (ON/OFF)

    if (heaterON) {
      // sterowanie z histerezą wokół tempZadana
      if (temp_in <= tempZadana - hyst1) {
        heatState = true;   // włącz grzanie
      } 
      else if (temp_in >= tempZadana + hyst2) {
        heatState = false;  // wyłącz grzanie
      }
    } else {
      // jeśli sterowanie grzałką wyłączone endpointem, to grzanie OFF
      heatState = false;
    }

    // wyjście: pełna moc albo 0
    output = heatState ? 255 : 0;
    analogWrite(heaterPin, (int)output);
  }
 
  // 5) Wysyłanie danych do Flask
  if (now - lastSend >= sendInterval) {
    lastSend = now;
    sendToFlask(temp_in, temp_out, hum, press, light, heaterON);
    Serial.print("||");
    Serial.print(temp_in);
    Serial.print("||");
    Serial.print(temp_out);
    Serial.print("||");
    Serial.print(hum);
    Serial.print("||");
    Serial.print(press);
    Serial.print("||");
    Serial.print(light);
    Serial.print("||");
    Serial.print(heaterON);
    Serial.print("||");
    Serial.print("||");
    Serial.print("||");
    Serial.print(output);
    Serial.println("||");
  }
 
  delay(1);
}