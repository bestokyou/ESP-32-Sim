/* __SPU_ENGINE_GUARD__ */
if(!window.SPUSim){ (function(){
/* =========================================================================
   SPU IoT BOARD SIMULATOR — engine (compiler + interpreter + hardware model)
   Headless: all DOM coupling goes through HOST / INPUTS.
   ========================================================================= */
const HOST = {
  log(){}, badge(){}, baud(){}, errLine(){}, source(){ return ""; }, canvas:null
};
const INPUTS = {
  temp:27.5, hum:54, adc:2048, shtOn:true,
  apSsid:"SPU-IoT", apPass:"12345678", apDelay:2500, apOn:true,
  timestamp:true, autoscroll:true
};
const ro=(get)=>({ get value(){ return get(); }, get checked(){ return get(); } });


const EXAMPLES = {"★ เริ่มเขียนใหม่ (Blank)": "#include <Arduino.h>\n\nvoid setup() {\n  Serial.begin(115200);\n  Serial.println(\"Hello SPU IoT Board!\");\n}\n\nvoid loop() {\n\n}\n", "★ ทดสอบอุปกรณ์บนบอร์ด (Self test)": "/* ทดสอบอุปกรณ์บนบอร์ดทั้งหมด : RGB + OLED + Buzzer + Relay + ปุ่ม + SHT31 */\n#include <Arduino.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n#include \"Adafruit_SHT31.h\"\n\n#define R_PIN 25\n#define G_PIN 26\n#define B_PIN 27\n#define aBtn 0\n#define bBtn 4\n#define relay01 32\n#define relay02 14\n#define BUZZER_PIN 33\n\nAdafruit_SSD1306 display(128, 64, &Wire, -1);\nAdafruit_SHT31 sht31 = Adafruit_SHT31();\nint step = 0;\n\nvoid setColor(bool r, bool g, bool b) {   // Common Anode : LOW = ติด\n  digitalWrite(R_PIN, r ? LOW : HIGH);\n  digitalWrite(G_PIN, g ? LOW : HIGH);\n  digitalWrite(B_PIN, b ? LOW : HIGH);\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  pinMode(R_PIN, OUTPUT); pinMode(G_PIN, OUTPUT); pinMode(B_PIN, OUTPUT);\n  pinMode(aBtn, INPUT);   pinMode(bBtn, INPUT);\n  pinMode(relay01, OUTPUT); pinMode(relay02, OUTPUT);\n  digitalWrite(relay01, HIGH); digitalWrite(relay02, HIGH);\n  ledcAttach(BUZZER_PIN, 2000, 8);\n  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  sht31.begin(0x44);\n  Serial.println(\"Board self test...\");\n}\n\nvoid loop() {\n  float t = sht31.readTemperature();\n  float h = sht31.readHumidity();\n\n  display.clearDisplay();\n  display.setTextSize(1); display.setTextColor(WHITE);\n  display.setCursor(0, 0);  display.println(\"SPU IoT BOARD TEST\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n  display.setCursor(0, 16); display.print(\"T = \"); display.print(t); display.println(\" C\");\n  display.setCursor(0, 28); display.print(\"H = \"); display.print(h); display.println(\" %\");\n  display.setCursor(0, 40); display.print(\"VR= \"); display.println(analogRead(36));\n  display.setCursor(0, 52);\n  display.print(\"A=\"); display.print(digitalRead(aBtn));\n  display.print(\"  B=\"); display.print(digitalRead(bBtn));\n  display.display();\n\n  step = (step + 1) % 4;\n  if (step == 0) { setColor(true, false, false); digitalWrite(relay01, LOW);  digitalWrite(relay02, HIGH); }\n  if (step == 1) { setColor(false, true, false); digitalWrite(relay01, HIGH); digitalWrite(relay02, LOW);  }\n  if (step == 2) { setColor(false, false, true); digitalWrite(relay01, LOW);  digitalWrite(relay02, LOW);  }\n  if (step == 3) {\n    setColor(true, true, true);\n    digitalWrite(relay01, HIGH); digitalWrite(relay02, HIGH);\n    ledcWriteTone(BUZZER_PIN, 2000); delay(150); ledcWriteTone(BUZZER_PIN, 0);\n  }\n\n  Serial.print(\"T:\"); Serial.print(t);\n  Serial.print(\" H:\"); Serial.print(h);\n  Serial.print(\" VR:\"); Serial.println(analogRead(36));\n  delay(1000);\n}\n", "ข้อ 1 · ปุ่ม A/B/A+B + RGB + OLED": "/* ==========================================================\n   ข้อ 1 : รับค่าจากปุ่ม แสดงผลไฟ RGB + จอ OLED\n   - กดปุ่ม A       -> ไฟสีแดง   , OLED : Button A\n   - กดปุ่ม B       -> ไฟสีเขียว , OLED : Button B\n   - กดปุ่ม A + B   -> ไฟสีขาว   , OLED : Button A+B\n   ========================================================== */\n#include <Arduino.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n\n// ---------- OLED ----------\n#define SCREEN_WIDTH   128\n#define SCREEN_HEIGHT  64\n#define OLED_RESET     -1\n#define SCREEN_ADDRESS 0x3C\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\n\n// ---------- ปุ่มกด ----------\n#define aBtn 0\n#define bBtn 4\n\n// ---------- RGB LED ----------\n#define R_PIN 25\n#define G_PIN 26\n#define B_PIN 27\n#define COMMON_ANODE true\n\nint lastState = -1;   // เก็บสถานะเดิม เพื่อไม่ให้จอกระพริบ\n\n// ฟังก์ชันสั่งสีไฟ RGB (true = ติด)\nvoid setColor(bool r, bool g, bool b) {\n  if (COMMON_ANODE) {\n    digitalWrite(R_PIN, r ? LOW : HIGH);\n    digitalWrite(G_PIN, g ? LOW : HIGH);\n    digitalWrite(B_PIN, b ? LOW : HIGH);\n  } else {\n    digitalWrite(R_PIN, r ? HIGH : LOW);\n    digitalWrite(G_PIN, g ? HIGH : LOW);\n    digitalWrite(B_PIN, b ? HIGH : LOW);\n  }\n}\n\n// แสดงผลบนจอ OLED\nvoid showOLED(String btnText, String colorText) {\n  display.clearDisplay();\n\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 1 : BUTTON + RGB\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  display.setTextSize(2);          // ข้อความหลัก ตัวใหญ่\n  display.setCursor(0, 20);\n  display.println(btnText);\n\n  display.setTextSize(1);\n  display.setCursor(0, 50);\n  display.print(\"LED : \");\n  display.println(colorText);\n\n  display.display();\n}\n\nvoid setup() {\n  Serial.begin(115200);\n\n  pinMode(aBtn, INPUT);\n  pinMode(bBtn, INPUT);\n\n  pinMode(R_PIN, OUTPUT);\n  pinMode(G_PIN, OUTPUT);\n  pinMode(B_PIN, OUTPUT);\n  setColor(false, false, false);   // เริ่มต้นดับทุกดวง\n\n  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {\n    Serial.println(F(\"SSD1306 allocation failed\"));\n    for (;;);\n  }\n  delay(1000);\n  showOLED(\"No Button\", \"OFF\");\n}\n\nvoid loop() {\n  // ปุ่มเป็น active LOW : กด = 0 , ไม่กด = 1\n  bool aPress = (digitalRead(aBtn) == LOW);\n  bool bPress = (digitalRead(bBtn) == LOW);\n\n  int state = 0;\n  if (aPress && bPress)      state = 3;   // A + B\n  else if (aPress)           state = 1;   // A\n  else if (bPress)           state = 2;   // B\n\n  if (state != lastState) {               // เปลี่ยนสถานะเมื่อมีการกดเท่านั้น\n    lastState = state;\n    switch (state) {\n      case 1:\n        setColor(true, false, false);                 // แดง\n        showOLED(\"Button A\", \"RED\");\n        Serial.println(\"Button A -> RED\");\n        break;\n      case 2:\n        setColor(false, true, false);                 // เขียว\n        showOLED(\"Button B\", \"GREEN\");\n        Serial.println(\"Button B -> GREEN\");\n        break;\n      case 3:\n        setColor(true, true, true);                   // ขาว (แดง+เขียว+น้ำเงิน)\n        showOLED(\"Button A+B\", \"WHITE\");\n        Serial.println(\"Button A+B -> WHITE\");\n        break;\n      default:\n        setColor(false, false, false);                // ดับ\n        showOLED(\"No Button\", \"OFF\");\n        Serial.println(\"No Button -> OFF\");\n        break;\n    }\n  }\n  delay(50);      // กันปุ่มเด้ง (debounce แบบง่าย)\n}\n", "ข้อ 2 · Toggle ปุ่ม + รีเลย์ + OLED": "/* ==========================================================\n   ข้อ 2 : ปุ่มกดแบบ Toggle ควบคุมรีเลย์ + จอ OLED\n   - กดปุ่ม A      -> สลับสถานะ Relay 1   , OLED : Button A\n   - กดปุ่ม B      -> สลับสถานะ Relay 2   , OLED : Button B\n   - กดปุ่ม A + B  -> สลับสถานะ Relay 1+2 , OLED : Button A+B\n   (รีเลย์เป็น active LOW : LOW = ON , HIGH = OFF)\n   ========================================================== */\n#include <Arduino.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n\n// ---------- OLED ----------\n#define SCREEN_WIDTH   128\n#define SCREEN_HEIGHT  64\n#define OLED_RESET     -1\n#define SCREEN_ADDRESS 0x3C\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\n\n// ---------- ปุ่มกด / รีเลย์ ----------\n#define aBtn    0\n#define bBtn    4\n#define relay01 32\n#define relay02 14\n\nbool relay1On = false;          // สถานะรีเลย์ 1\nbool relay2On = false;          // สถานะรีเลย์ 2\nString lastBtn = \"-\";           // ปุ่มที่กดล่าสุด\n\nunsigned long lastDebounceTime = 0;\nconst unsigned long debounceDelay = 50;\nbool lastPressed = false;       // สถานะ \"มีปุ่มถูกกดอยู่\" ครั้งก่อน\n\n// เขียนค่าออกรีเลย์\nvoid updateRelay() {\n  digitalWrite(relay01, relay1On ? LOW : HIGH);\n  digitalWrite(relay02, relay2On ? LOW : HIGH);\n}\n\nvoid showOLED() {\n  display.clearDisplay();\n\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 2 : TOGGLE RELAY\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  display.setTextSize(2);\n  display.setCursor(0, 16);\n  display.println(lastBtn);\n\n  display.setTextSize(1);\n  display.setCursor(0, 40);\n  display.print(\"Relay 1 : \");\n  display.println(relay1On ? \"ON\" : \"OFF\");\n  display.setCursor(0, 52);\n  display.print(\"Relay 2 : \");\n  display.println(relay2On ? \"ON\" : \"OFF\");\n\n  display.display();\n}\n\nvoid setup() {\n  Serial.begin(115200);\n\n  pinMode(aBtn, INPUT);\n  pinMode(bBtn, INPUT);\n  pinMode(relay01, OUTPUT);\n  pinMode(relay02, OUTPUT);\n  updateRelay();                 // เริ่มต้น OFF ทั้งคู่\n\n  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {\n    Serial.println(F(\"SSD1306 allocation failed\"));\n    for (;;);\n  }\n  delay(1000);\n  lastBtn = \"Ready\";\n  showOLED();\n}\n\nvoid loop() {\n  bool aPress = (digitalRead(aBtn) == LOW);\n  bool bPress = (digitalRead(bBtn) == LOW);\n  bool pressed = (aPress || bPress);\n\n  // จับเฉพาะ \"ขอบขาขึ้น\" คือเปลี่ยนจากไม่กด -> กด (Toggle 1 ครั้งต่อ 1 การกด)\n  if (pressed && !lastPressed && (millis() - lastDebounceTime) > debounceDelay) {\n    lastDebounceTime = millis();\n\n    delay(80);                   // รอเผื่อกดปุ่มที่สองตามมา (กรณี A+B)\n    aPress = (digitalRead(aBtn) == LOW);\n    bPress = (digitalRead(bBtn) == LOW);\n\n    if (aPress && bPress) {                 // กด A + B\n      relay1On = !relay1On;\n      relay2On = !relay2On;\n      lastBtn  = \"Button A+B\";\n    } else if (aPress) {                    // กด A\n      relay1On = !relay1On;\n      lastBtn  = \"Button A\";\n    } else if (bPress) {                    // กด B\n      relay2On = !relay2On;\n      lastBtn  = \"Button B\";\n    }\n\n    updateRelay();\n    showOLED();\n    Serial.println(lastBtn + \" -> R1:\" + String(relay1On ? \"ON\" : \"OFF\") +\n                             \"  R2:\" + String(relay2On ? \"ON\" : \"OFF\"));\n  }\n\n  lastPressed = pressed;\n  delay(10);\n}\n", "ข้อ 3 · SHT31 + OLED + RGB + Buzzer": "/* ==========================================================\n   ข้อ 3 : อ่านอุณหภูมิ/ความชื้น SHT31 แสดงบน OLED\n           + แสดงสถานะไฟ RGB + เสียงเตือน Buzzer\n   - ต่ำกว่า 28 องศา   -> สีน้ำเงิน (Blue)\n   - 28 - 29 องศา     -> สีเหลือง (Yellow = แดง+เขียว)\n   - มากกว่า 29 องศา  -> สีแดง (Red) + เสียงเตือนที่ Buzzer\n   ========================================================== */\n#include <Arduino.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n#include \"Adafruit_SHT31.h\"\n\n// ---------- OLED ----------\n#define SCREEN_WIDTH   128\n#define SCREEN_HEIGHT  64\n#define OLED_RESET     -1\n#define SCREEN_ADDRESS 0x3C\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\n\n// ---------- SHT31 ----------\nAdafruit_SHT31 sht31 = Adafruit_SHT31();\n\n// ---------- RGB LED ----------\n#define R_PIN 25\n#define G_PIN 26\n#define B_PIN 27\n#define COMMON_ANODE true\n\n// ---------- Buzzer ----------\n#define BUZZER_PIN  33\n\nvoid setColor(bool r, bool g, bool b) {\n  if (COMMON_ANODE) {\n    digitalWrite(R_PIN, r ? LOW : HIGH);\n    digitalWrite(G_PIN, g ? LOW : HIGH);\n    digitalWrite(B_PIN, b ? LOW : HIGH);\n  } else {\n    digitalWrite(R_PIN, r ? HIGH : LOW);\n    digitalWrite(G_PIN, g ? HIGH : LOW);\n    digitalWrite(B_PIN, b ? HIGH : LOW);\n  }\n}\n\n// เสียงเตือน : ดัง count ครั้ง\nvoid beep(int count, int freq, int onMs, int offMs) {\n  for (int i = 0; i < count; i++) {\n    ledcWriteTone(BUZZER_PIN, freq);\n    delay(onMs);\n    ledcWriteTone(BUZZER_PIN, 0);\n    delay(offMs);\n  }\n}\n\nvoid showOLED(float t, float h, String status) {\n  display.clearDisplay();\n\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 3 : SHT31 + RGB\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  display.setTextSize(2);\n  display.setCursor(0, 16);\n  display.print(\"T:\"); display.print(t, 1); display.print(\" C\");\n\n  display.setCursor(0, 34);\n  display.print(\"H:\"); display.print(h, 1); display.print(\" %\");\n\n  display.setTextSize(1);\n  display.setCursor(0, 54);\n  display.print(\"ST: \"); display.print(status);\n\n  display.display();\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  Serial.println(\"EXAM 3 : SHT31 + OLED + RGB + BUZZER\");\n\n  pinMode(R_PIN, OUTPUT);\n  pinMode(G_PIN, OUTPUT);\n  pinMode(B_PIN, OUTPUT);\n  setColor(false, false, false);\n\n  ledcAttach(BUZZER_PIN, 2000, 8);           // ตั้งค่า PWM ให้ buzzer\n  ledcWriteTone(BUZZER_PIN, 0);\n\n  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {\n    Serial.println(F(\"SSD1306 allocation failed\"));\n    for (;;);\n  }\n  display.clearDisplay();\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 20);\n  display.println(\"Starting SHT31...\");\n  display.display();\n\n  if (!sht31.begin(0x44)) {\n    Serial.println(\"Couldn't find SHT31\");\n    while (1) delay(1);\n  }\n  delay(1000);\n}\n\nvoid loop() {\n  float t = sht31.readTemperature();\n  float h = sht31.readHumidity();\n\n  if (isnan(t) || isnan(h)) {\n    Serial.println(\"Failed to read from SHT31 sensor!\");\n    return;\n  }\n\n  String status;\n  if (t < 28) {                       // เย็น -> น้ำเงิน\n    setColor(false, false, true);\n    status = \"COLD  (BLUE)\";\n    Serial.print(\"=> Cold! (Blue)  \");\n  }\n  else if (t >= 28 && t <= 29) {      // ปกติ -> เหลือง\n    setColor(true, true, false);\n    status = \"WARM  (YELLOW)\";\n    Serial.print(\"=> Warm! (Yellow)  \");\n  }\n  else {                              // ร้อน -> แดง + เสียงเตือน\n    setColor(true, false, false);\n    status = \"HOT (RED) *BEEP*\";\n    Serial.print(\"=> Hot! (Red) + Buzzer  \");\n  }\n\n  Serial.print(\"Temp : \"); Serial.print(t);\n  Serial.print(\" C , Humidity : \"); Serial.print(h); Serial.println(\" %\");\n\n  showOLED(t, h, status);\n\n  if (t > 29) beep(2, 2000, 120, 120);   // เสียงเตือนเมื่ออุณหภูมิสูง\n\n  delay(1000);\n}\n", "ข้อ 4 · SHT31 + OLED + Relay + Buzzer": "/* ==========================================================\n   ข้อ 4 : อ่านอุณหภูมิ/ความชื้น SHT31 แสดงบน OLED\n           + ควบคุมรีเลย์ตามอุณหภูมิ + เสียงเตือน Buzzer\n   - ต่ำกว่า 28 องศา   -> Relay 1 ทำงาน\n   - 28 - 29 องศา     -> Relay 2 ทำงาน\n   - มากกว่า 29 องศา  -> ปิดรีเลย์ทั้งคู่ + เสียงเตือนที่ Buzzer\n   (รีเลย์เป็น active LOW : LOW = ON , HIGH = OFF)\n   ========================================================== */\n#include <Arduino.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n#include \"Adafruit_SHT31.h\"\n\n// ---------- OLED ----------\n#define SCREEN_WIDTH   128\n#define SCREEN_HEIGHT  64\n#define OLED_RESET     -1\n#define SCREEN_ADDRESS 0x3C\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\n\n// ---------- SHT31 ----------\nAdafruit_SHT31 sht31 = Adafruit_SHT31();\n\n// ---------- Relay ----------\n#define relay01 32\n#define relay02 14\n\n// ---------- Buzzer ----------\n#define BUZZER_PIN  33\n\nvoid setRelay(bool r1, bool r2) {\n  digitalWrite(relay01, r1 ? LOW : HIGH);\n  digitalWrite(relay02, r2 ? LOW : HIGH);\n}\n\nvoid beep(int count, int freq, int onMs, int offMs) {\n  for (int i = 0; i < count; i++) {\n    ledcWriteTone(BUZZER_PIN, freq);\n    delay(onMs);\n    ledcWriteTone(BUZZER_PIN, 0);\n    delay(offMs);\n  }\n}\n\nvoid showOLED(float t, float h, bool r1, bool r2, String note) {\n  display.clearDisplay();\n\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 4 : SHT31 + RELAY\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  display.setTextSize(2);\n  display.setCursor(0, 14);\n  display.print(\"T:\"); display.print(t, 1); display.print(\" C\");\n\n  display.setCursor(0, 32);\n  display.print(\"H:\"); display.print(h, 1); display.print(\" %\");\n\n  display.setTextSize(1);\n  display.setCursor(0, 52);\n  display.print(\"R1:\"); display.print(r1 ? \"ON \" : \"OFF\");\n  display.print(\" R2:\"); display.print(r2 ? \"ON \" : \"OFF\");\n  display.print(\" \"); display.print(note);\n\n  display.display();\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  Serial.println(\"EXAM 4 : SHT31 + OLED + RELAY + BUZZER\");\n\n  pinMode(relay01, OUTPUT);\n  pinMode(relay02, OUTPUT);\n  setRelay(false, false);\n\n  ledcAttach(BUZZER_PIN, 2000, 8);\n  ledcWriteTone(BUZZER_PIN, 0);\n\n  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {\n    Serial.println(F(\"SSD1306 allocation failed\"));\n    for (;;);\n  }\n  display.clearDisplay();\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 20);\n  display.println(\"Starting SHT31...\");\n  display.display();\n\n  if (!sht31.begin(0x44)) {\n    Serial.println(\"Couldn't find SHT31\");\n    while (1) delay(1);\n  }\n  delay(1000);\n}\n\nvoid loop() {\n  float t = sht31.readTemperature();\n  float h = sht31.readHumidity();\n\n  if (isnan(t) || isnan(h)) {\n    Serial.println(\"Failed to read from SHT31 sensor!\");\n    return;\n  }\n\n  bool r1 = false, r2 = false;\n  bool alarm = false;\n  String note = \"\";\n\n  if (t < 28) {                        // เย็น -> รีเลย์ 1 ทำงาน\n    r1 = true;  r2 = false;\n    note = \"\";\n    Serial.print(\"=> Relay 1 ON   \");\n  }\n  else if (t >= 28 && t <= 29) {       // ปกติ -> รีเลย์ 2 ทำงาน\n    r1 = false; r2 = true;\n    note = \"\";\n    Serial.print(\"=> Relay 2 ON   \");\n  }\n  else {                               // ร้อน -> ปิดรีเลย์ + เสียงเตือน\n    r1 = false; r2 = false;\n    alarm = true;\n    note = \"ALM\";\n    Serial.print(\"=> ALARM Buzzer \");\n  }\n\n  setRelay(r1, r2);\n\n  Serial.print(\"Temp : \"); Serial.print(t);\n  Serial.print(\" C , Humidity : \"); Serial.print(h); Serial.println(\" %\");\n\n  showOLED(t, h, r1, r2, note);\n\n  if (alarm) beep(3, 2500, 120, 100);\n\n  delay(1000);\n}\n", "ข้อ 5 · WiFi + RGB + Buzzer + IP บน OLED": "/* ==========================================================\n   ข้อ 5 : เชื่อมต่อ WiFi + แสดงสถานะด้วยไฟ RGB / Buzzer / OLED\n   - ยังไม่เชื่อมต่อ      -> ไฟสีแดงกระพริบ\n   - เชื่อมต่อสำเร็จ     -> ไฟสีน้ำเงินติดค้าง + เสียงที่ Buzzer\n   - แสดง IP Address ที่ได้รับ บนจอ OLED\n   ========================================================== */\n#include <Arduino.h>\n#include <WiFi.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n\n// ---------- แก้ชื่อ WiFi / รหัสผ่าน ตรงนี้ ----------\nconst char* ssid     = \"SPU-IoT\";\nconst char* password = \"12345678\";\n\n// ---------- OLED ----------\n#define SCREEN_WIDTH   128\n#define SCREEN_HEIGHT  64\n#define OLED_RESET     -1\n#define SCREEN_ADDRESS 0x3C\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\n\n// ---------- RGB LED ----------\n#define R_PIN 25\n#define G_PIN 26\n#define B_PIN 27\n#define COMMON_ANODE true\n\n// ---------- Buzzer ----------\n#define BUZZER_PIN  33\n\nvoid setColor(bool r, bool g, bool b) {\n  if (COMMON_ANODE) {\n    digitalWrite(R_PIN, r ? LOW : HIGH);\n    digitalWrite(G_PIN, g ? LOW : HIGH);\n    digitalWrite(B_PIN, b ? LOW : HIGH);\n  } else {\n    digitalWrite(R_PIN, r ? HIGH : LOW);\n    digitalWrite(G_PIN, g ? HIGH : LOW);\n    digitalWrite(B_PIN, b ? HIGH : LOW);\n  }\n}\n\nvoid tone_(int freq, int ms) {\n  ledcWriteTone(BUZZER_PIN, freq);\n  delay(ms);\n  ledcWriteTone(BUZZER_PIN, 0);\n}\n\n// เสียงตอนเชื่อมต่อสำเร็จ (เสียงสูงขึ้น 3 ตัว)\nvoid soundConnected() {\n  tone_(1500, 120); delay(40);\n  tone_(2000, 120); delay(40);\n  tone_(2600, 200);\n}\n\n// หน้าจอตอนกำลังเชื่อมต่อ\nvoid showConnecting(int dot) {\n  display.clearDisplay();\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 5 : WiFi CONNECT\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  display.setTextSize(2);\n  display.setCursor(0, 20);\n  display.println(\"Connect\");\n\n  display.setTextSize(1);\n  display.setCursor(0, 44);\n  display.print(\"SSID: \"); display.println(ssid);\n  display.setCursor(0, 56);\n  display.print(\"Waiting\");\n  for (int i = 0; i < dot; i++) display.print(\".\");\n  display.display();\n}\n\n// หน้าจอตอนเชื่อมต่อสำเร็จ\nvoid showConnected() {\n  display.clearDisplay();\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 5 : WiFi CONNECT\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  display.setTextSize(2);\n  display.setCursor(0, 14);\n  display.println(\"ONLINE\");\n\n  display.setTextSize(1);\n  display.setCursor(0, 34);\n  display.print(\"SSID: \"); display.println(ssid);\n\n  display.drawRect(0, 44, 128, 20, WHITE);\n  display.setCursor(4, 48);\n  display.print(\"IP: \");\n  display.println(WiFi.localIP());\n  display.display();\n}\n\nvoid setup() {\n  Serial.begin(115200);\n\n  pinMode(R_PIN, OUTPUT);\n  pinMode(G_PIN, OUTPUT);\n  pinMode(B_PIN, OUTPUT);\n  setColor(false, false, false);\n\n  ledcAttach(BUZZER_PIN, 2000, 8);\n  ledcWriteTone(BUZZER_PIN, 0);\n\n  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {\n    Serial.println(F(\"SSD1306 allocation failed\"));\n    for (;;);\n  }\n  delay(500);\n\n  // ---------- เริ่มเชื่อมต่อ WiFi ----------\n  Serial.print(\"Connecting to \"); Serial.println(ssid);\n  WiFi.mode(WIFI_STA);\n  WiFi.begin(ssid, password);\n\n  bool led = false;\n  int  dot = 0;\n  while (WiFi.status() != WL_CONNECTED) {\n    led = !led;\n    setColor(led, false, false);      // ไฟแดงกระพริบ ระหว่างรอเชื่อมต่อ\n    showConnecting(dot);\n    dot = (dot + 1) % 4;\n    Serial.print(\".\");\n    delay(300);\n  }\n\n  // ---------- เชื่อมต่อสำเร็จ ----------\n  setColor(false, false, true);       // ไฟน้ำเงินติดค้าง\n  soundConnected();                   // เสียงแจ้งเตือน\n  showConnected();\n\n  Serial.println();\n  Serial.println(\"WiFi connected!\");\n  Serial.print(\"IP Address : \"); Serial.println(WiFi.localIP());\n}\n\nvoid loop() {\n  // ถ้าหลุดการเชื่อมต่อ ให้กลับไปกระพริบสีแดง แล้วต่อใหม่\n  if (WiFi.status() != WL_CONNECTED) {\n    Serial.println(\"WiFi disconnected... reconnecting\");\n    WiFi.begin(ssid, password);\n\n    bool led = false;\n    int  dot = 0;\n    while (WiFi.status() != WL_CONNECTED) {\n      led = !led;\n      setColor(led, false, false);\n      showConnecting(dot);\n      dot = (dot + 1) % 4;\n      delay(300);\n    }\n    setColor(false, false, true);\n    soundConnected();\n    showConnected();\n  }\n  delay(1000);\n}\n", "ข้อ 6 · กราฟิก WiFi Connect/Disconnect": "/* ==========================================================\n   ข้อ 6 : แสดงรูปภาพกราฟิกสถานะการเชื่อมต่อ WiFi บนจอ OLED\n   - ภาพที่ 1 : WiFi Connected     (ไอคอน WiFi เต็ม)\n   - ภาพที่ 2 : WiFi Disconnected  (ไอคอน WiFi มีขีดคาด)\n   - ยังไม่เชื่อมต่อ  -> ไฟ RGB สีแดงกระพริบ\n   - เชื่อมต่อสำเร็จ -> ไฟ RGB สีน้ำเงินติดค้าง\n   ภาพกราฟิกขนาด 40x40 px (สร้างแบบเดียวกับ image2cpp)\n   ========================================================== */\n#include <Arduino.h>\n#include <WiFi.h>\n#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>\n\n// ---------- แก้ชื่อ WiFi / รหัสผ่าน ตรงนี้ ----------\nconst char* ssid     = \"SPU-IoT\";\nconst char* password = \"12345678\";\n\n// ---------- OLED ----------\n#define SCREEN_WIDTH   128\n#define SCREEN_HEIGHT  64\n#define OLED_RESET     -1\n#define SCREEN_ADDRESS 0x3C\nAdafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);\n\n// ---------- RGB LED ----------\n#define R_PIN 25\n#define G_PIN 26\n#define B_PIN 27\n#define COMMON_ANODE true\n\n// ---------- Buzzer (เพิ่มเติม) ----------\n#define BUZZER_PIN  33\n\n// ==========================================================\n//  รูปที่ 1 : WiFi Connect  (40 x 40)\n// ==========================================================\nconst unsigned char wifi_on_bmp [] PROGMEM = {\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0xFF, 0x00, 0x00,\n  0x00, 0x07, 0xFF, 0xE0, 0x00,\n  0x00, 0x1F, 0xFF, 0xF8, 0x00,\n  0x00, 0x7F, 0x00, 0xFE, 0x00,\n  0x00, 0xF8, 0x00, 0x1F, 0x00,\n  0x01, 0xE0, 0x00, 0x07, 0x80,\n  0x01, 0xC1, 0xFF, 0x83, 0x80,\n  0x00, 0x87, 0xFF, 0xE1, 0x00,\n  0x00, 0x0F, 0xFF, 0xF0, 0x00,\n  0x00, 0x3F, 0x00, 0xFC, 0x00,\n  0x00, 0x1C, 0x00, 0x38, 0x00,\n  0x00, 0x08, 0x7E, 0x10, 0x00,\n  0x00, 0x01, 0xFF, 0x80, 0x00,\n  0x00, 0x03, 0xFF, 0xC0, 0x00,\n  0x00, 0x01, 0xC3, 0x80, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x3C, 0x00, 0x00,\n  0x00, 0x00, 0x7E, 0x00, 0x00,\n  0x00, 0x00, 0x7E, 0x00, 0x00,\n  0x00, 0x00, 0x7E, 0x00, 0x00,\n  0x00, 0x00, 0x7E, 0x00, 0x00,\n  0x00, 0x00, 0x3C, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00\n};\n\n// ==========================================================\n//  รูปที่ 2 : WiFi Disconnect  (40 x 40)\n// ==========================================================\nconst unsigned char wifi_off_bmp [] PROGMEM = {\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x04, 0x00, 0x00, 0x00, 0x00,\n  0x0E, 0x00, 0x00, 0x00, 0x00,\n  0x1F, 0x00, 0x00, 0x00, 0x00,\n  0x0F, 0x80, 0x00, 0x00, 0x00,\n  0x07, 0xC0, 0x00, 0x00, 0x00,\n  0x03, 0xE0, 0x00, 0x00, 0x00,\n  0x01, 0xF0, 0x00, 0x00, 0x00,\n  0x00, 0xF8, 0x00, 0x00, 0x00,\n  0x00, 0x7C, 0x00, 0x00, 0x00,\n  0x00, 0x3E, 0x00, 0x00, 0x00,\n  0x00, 0x1F, 0x3F, 0x00, 0x00,\n  0x00, 0x0F, 0x9F, 0xE0, 0x00,\n  0x00, 0x07, 0xCF, 0xF8, 0x00,\n  0x00, 0x73, 0xE0, 0xFE, 0x00,\n  0x00, 0xF9, 0xF0, 0x1F, 0x00,\n  0x01, 0xE0, 0xF8, 0x07, 0x80,\n  0x01, 0xC0, 0x7C, 0x83, 0x80,\n  0x00, 0x87, 0x3E, 0x61, 0x00,\n  0x00, 0x0F, 0x9F, 0x30, 0x00,\n  0x00, 0x3F, 0x0F, 0x9C, 0x00,\n  0x00, 0x1C, 0x07, 0xC8, 0x00,\n  0x00, 0x08, 0x73, 0xE0, 0x00,\n  0x00, 0x01, 0xF9, 0xF0, 0x00,\n  0x00, 0x03, 0xFC, 0xF8, 0x00,\n  0x00, 0x01, 0xC2, 0x7C, 0x00,\n  0x00, 0x00, 0x00, 0x3E, 0x00,\n  0x00, 0x00, 0x3C, 0x1F, 0x00,\n  0x00, 0x00, 0x7E, 0x0F, 0x80,\n  0x00, 0x00, 0x7E, 0x07, 0xC0,\n  0x00, 0x00, 0x7E, 0x03, 0xE0,\n  0x00, 0x00, 0x7E, 0x01, 0xF0,\n  0x00, 0x00, 0x3C, 0x00, 0xF8,\n  0x00, 0x00, 0x00, 0x00, 0x7C,\n  0x00, 0x00, 0x00, 0x00, 0x38,\n  0x00, 0x00, 0x00, 0x00, 0x10,\n  0x00, 0x00, 0x00, 0x00, 0x00,\n  0x00, 0x00, 0x00, 0x00, 0x00\n};\n\n#define ICON_W 40\n#define ICON_H 40\n\nbool wifiOK = false;\n\nvoid setColor(bool r, bool g, bool b) {\n  if (COMMON_ANODE) {\n    digitalWrite(R_PIN, r ? LOW : HIGH);\n    digitalWrite(G_PIN, g ? LOW : HIGH);\n    digitalWrite(B_PIN, b ? LOW : HIGH);\n  } else {\n    digitalWrite(R_PIN, r ? HIGH : LOW);\n    digitalWrite(G_PIN, g ? HIGH : LOW);\n    digitalWrite(B_PIN, b ? HIGH : LOW);\n  }\n}\n\nvoid tone_(int freq, int ms) {\n  ledcWriteTone(BUZZER_PIN, freq);\n  delay(ms);\n  ledcWriteTone(BUZZER_PIN, 0);\n}\n\n// วาดหน้าจอตามสถานะ\nvoid showStatus(bool connected) {\n  display.clearDisplay();\n\n  display.setTextSize(1);\n  display.setTextColor(WHITE);\n  display.setCursor(0, 0);\n  display.println(\"EXAM 6 : WiFi GRAPHIC\");\n  display.drawLine(0, 10, 127, 10, WHITE);\n\n  // วาดรูปกราฟิกตรงกลาง\n  display.drawBitmap(44, 13, connected ? wifi_on_bmp : wifi_off_bmp,\n                     ICON_W, ICON_H, WHITE);\n\n  display.setTextSize(1);\n  if (connected) {\n    display.setCursor(22, 55);\n    display.print(\"WiFi Connected\");\n  } else {\n    display.setCursor(16, 55);\n    display.print(\"WiFi Disconnect\");\n  }\n  display.display();\n}\n\nvoid setup() {\n  Serial.begin(115200);\n\n  pinMode(R_PIN, OUTPUT);\n  pinMode(G_PIN, OUTPUT);\n  pinMode(B_PIN, OUTPUT);\n  setColor(false, false, false);\n\n  ledcAttach(BUZZER_PIN, 2000, 8);\n  ledcWriteTone(BUZZER_PIN, 0);\n\n  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {\n    Serial.println(F(\"SSD1306 allocation failed\"));\n    for (;;);\n  }\n  delay(500);\n\n  showStatus(false);                 // เริ่มต้น = ยังไม่เชื่อมต่อ\n\n  Serial.print(\"Connecting to \"); Serial.println(ssid);\n  WiFi.mode(WIFI_STA);\n  WiFi.begin(ssid, password);\n}\n\nvoid loop() {\n  if (WiFi.status() != WL_CONNECTED) {\n    // ---------- ยังไม่เชื่อมต่อ : รูป Disconnect + ไฟแดงกระพริบ ----------\n    if (wifiOK) {                    // เพิ่งหลุดการเชื่อมต่อ\n      wifiOK = false;\n      showStatus(false);\n      WiFi.begin(ssid, password);\n      Serial.println(\"WiFi disconnected... reconnecting\");\n    }\n    setColor(true, false, false);    // แดงติด\n    delay(300);\n    setColor(false, false, false);   // แดงดับ -> กระพริบ\n    delay(300);\n    Serial.print(\".\");\n  }\n  else {\n    // ---------- เชื่อมต่อสำเร็จ : รูป Connect + ไฟน้ำเงินติดค้าง ----------\n    if (!wifiOK) {                   // เพิ่งเชื่อมต่อได้\n      wifiOK = true;\n      showStatus(true);\n      tone_(2000, 100); delay(50); tone_(2600, 150);   // เสียงแจ้งเตือน\n      Serial.println();\n      Serial.println(\"WiFi connected!\");\n      Serial.print(\"IP Address : \"); Serial.println(WiFi.localIP());\n    }\n    setColor(false, false, true);    // น้ำเงินติดค้าง\n    delay(500);\n  }\n}\n"};

/* =========================================================================
   SPU IoT BOARD SIMULATOR — Arduino C++ subset : Preprocessor / Lexer / Parser
   ========================================================================= */
const SKETCH = "sketch.ino";

class CompileError extends Error{
  constructor(msg,line,ctx){ super(msg); this.line=line||0; this.ctx=ctx||""; }
}
class RuntimeErr extends Error{
  constructor(msg,line){ super(msg); this.line=line||0; }
}

/* ---------------- preprocessor ---------------- */
function preprocess(src){
  const macros = {}, includes = [];
  const lines = src.split("\n");
  const out = lines.map(raw=>{
    const t = raw.trim();
    if(!t.startsWith("#")) return raw;
    let m = t.match(/^#\s*include\s*[<"]([^>"]+)[>"]/);
    if(m){ includes.push(m[1].toLowerCase()); return ""; }
    m = t.match(/^#\s*define\s+([A-Za-z_]\w*)\s*(.*)$/);
    if(m){
      let val = m[2];
      const ci = val.indexOf("//"); if(ci>=0) val = val.slice(0,ci);
      const cb = val.indexOf("/*"); if(cb>=0) val = val.slice(0,cb);
      macros[m[1]] = val.trim();
      return "";
    }
    return ""; // #ifdef / #pragma / etc -> ignore
  });
  return { code: out.join("\n"), macros, includes };
}

/* ---------------- lexer ---------------- */
const OPLIST = ["<<=",">>=","->","++","--","<<",">>","<=",">=","==","!=","&&","||",
  "+=","-=","*=","/=","%=","&=","|=","^=","::","{","}","(",")","[","]",";",",",".",
  "+","-","*","/","%","=","<",">","!","~","&","|","^","?",":"];

function lex(code){
  const toks=[]; let i=0, line=1;
  const push=(t,v)=>toks.push({t,v,line});
  while(i<code.length){
    const c=code[i];
    if(c==="\n"){ line++; i++; continue; }
    if(c===" "||c==="\t"||c==="\r"){ i++; continue; }
    if(c==="/"&&code[i+1]==="/"){ while(i<code.length&&code[i]!=="\n") i++; continue; }
    if(c==="/"&&code[i+1]==="*"){
      i+=2;
      while(i<code.length&&!(code[i]==="*"&&code[i+1]==="/")){ if(code[i]==="\n") line++; i++; }
      i+=2; continue;
    }
    if(c==='"'){
      let s=""; i++;
      while(i<code.length&&code[i]!=='"'){
        if(code[i]==="\\"){ s+=unesc(code[i+1]); i+=2; }
        else { if(code[i]==="\n") line++; s+=code[i++]; }
      }
      i++; push("str",s); continue;
    }
    if(c==="'"){
      let s=""; i++;
      while(i<code.length&&code[i]!=="'"){
        if(code[i]==="\\"){ s+=unesc(code[i+1]); i+=2; } else s+=code[i++];
      }
      i++; push("char", s.charCodeAt(0)||0); continue;
    }
    if(/[0-9]/.test(c) || (c==="."&&/[0-9]/.test(code[i+1]||""))){
      let j=i;
      if(c==="0"&&(code[i+1]==="x"||code[i+1]==="X")){
        j=i+2; while(j<code.length&&/[0-9a-fA-F]/.test(code[j])) j++;
        push("num",{v:parseInt(code.slice(i,j),16),f:false}); i=j; continue;
      }
      if(c==="0"&&(code[i+1]==="b"||code[i+1]==="B")){
        j=i+2; while(j<code.length&&/[01]/.test(code[j])) j++;
        push("num",{v:parseInt(code.slice(i+2,j),2),f:false}); i=j; continue;
      }
      let isF=false;
      while(j<code.length&&/[0-9]/.test(code[j])) j++;
      if(code[j]==="."){ isF=true; j++; while(j<code.length&&/[0-9]/.test(code[j])) j++; }
      if(code[j]==="e"||code[j]==="E"){ isF=true; j++; if(code[j]==="+"||code[j]==="-") j++; while(j<code.length&&/[0-9]/.test(code[j])) j++; }
      const txt=code.slice(i,j);
      while(j<code.length&&/[fFuUlL]/.test(code[j])){ if(code[j]==="f"||code[j]==="F") isF=true; j++; }
      push("num",{v:parseFloat(txt),f:isF}); i=j; continue;
    }
    if(/[A-Za-z_]/.test(c)){
      let j=i; while(j<code.length&&/[A-Za-z0-9_]/.test(code[j])) j++;
      push("id",code.slice(i,j)); i=j; continue;
    }
    let matched=null;
    for(const op of OPLIST){ if(code.startsWith(op,i)){ matched=op; break; } }
    if(matched){ push("op",matched); i+=matched.length; continue; }
    throw new CompileError("stray '"+c+"' in program", line);
  }
  push("eof",null);
  return toks;
}
function unesc(c){
  return ({n:"\n",t:"\t",r:"\r","0":"\0","\\":"\\","'":"'",'"':'"'})[c] ?? c;
}

/* macro expansion on token stream */
function expandMacros(toks, macros){
  let out=toks, pass=0;
  while(pass++<8){
    let changed=false;
    const next=[];
    for(const tk of out){
      if(tk.t==="id" && Object.prototype.hasOwnProperty.call(macros,tk.v)){
        const body=macros[tk.v];
        if(body===""){ changed=true; continue; }
        const sub=lex(body).filter(x=>x.t!=="eof").map(x=>({...x,line:tk.line}));
        next.push(...sub); changed=true;
      } else next.push(tk);
    }
    out=next;
    if(!changed) break;
  }
  return out;
}

/* ---------------- parser ---------------- */
const PRIMS = new Set(["void","int","float","double","bool","boolean","char","byte","long","short",
  "unsigned","signed","String","uint8_t","uint16_t","uint32_t","int8_t","int16_t","int32_t",
  "size_t","word","auto"]);
const QUALS = new Set(["const","static","volatile","PROGMEM","unsigned","signed","extern","inline"]);

class Parser{
  constructor(toks){ this.k=toks; this.p=0; }
  peek(n=0){ return this.k[this.p+n]; }
  get cur(){ return this.k[this.p]; }
  get line(){ return this.cur.line; }
  is(t,v){ const c=this.cur; return c.t===t && (v===undefined||c.v===v); }
  isOp(v){ return this.is("op",v); }
  isId(v){ return this.is("id",v); }
  next(){ return this.k[this.p++]; }
  expect(t,v){
    if(!this.is(t,v)){
      const got = this.cur.t==="eof" ? "end of file" : String(this.cur.v);
      throw new CompileError("expected '"+v+"' before '"+got+"'", this.line);
    }
    return this.next();
  }
  eatOp(v){ if(this.isOp(v)){ this.next(); return true;} return false; }

  /* --- type detection --- */
  atType(){
    const c=this.cur;
    if(c.t!=="id") return false;
    if(PRIMS.has(c.v)||QUALS.has(c.v)) return true;
    // ClassName ident  ->  declaration
    if(/^[A-Z][A-Za-z0-9_]*$/.test(c.v)){
      const n=this.peek(1);
      if(n && n.t==="id") return true;
    }
    return false;
  }
  parseType(){
    let parts=[];
    while(this.cur.t==="id" && (PRIMS.has(this.cur.v)||QUALS.has(this.cur.v)||
          (parts.length===0 && /^[A-Z]/.test(this.cur.v)))){
      const w=this.next().v;
      if(w!=="PROGMEM") parts.push(w);
      if(!PRIMS.has(w)&&!QUALS.has(w)) break;              // class name : stop
      if(this.cur.t==="id" && !PRIMS.has(this.cur.v) && !QUALS.has(this.cur.v)) break;
    }
    let ptr=0; while(this.eatOp("*")) ptr++;
    if(this.isOp("&")) this.next();
    return { name: parts.filter(x=>!QUALS.has(x)||x==="unsigned").join(" ")||parts.join(" "),
             raw: parts.join(" "), ptr, isConst: parts.includes("const") };
  }

  parseProgram(){
    const decls=[];
    while(!this.is("eof")){
      if(this.eatOp(";")) continue;
      decls.push(this.parseTopLevel());
    }
    return decls;
  }
  parseTopLevel(){
    const ln=this.line;
    if(!this.atType()){
      // maybe stray expression at top level
      throw new CompileError("expected unqualified-id before '"+String(this.cur.v)+"'", ln);
    }
    const type=this.parseType();
    if(this.is("eof")) throw new CompileError("expected declarator", ln);
    const nameTok=this.cur;
    if(nameTok.t!=="id") throw new CompileError("expected identifier before '"+String(nameTok.v)+"'", ln);
    this.next();
    const isClass = !PRIMS.has(type.raw.split(" ").pop()) && /^[A-Z]/.test(type.raw.split(" ").pop()||"");
    if(this.isOp("(") && !isClass){
      // function definition / prototype
      const params=this.parseParams();
      if(this.eatOp(";")) return {k:"proto",name:nameTok.v,line:ln};
      const body=this.parseBlock();
      return {k:"func",name:nameTok.v,ret:type,params,body,line:ln};
    }
    return this.finishVarDecl(type,nameTok.v,ln,true);
  }
  parseParams(){
    this.expect("op","(");
    const ps=[];
    while(!this.isOp(")")){
      if(this.isId("void") && this.peek(1).t==="op" && this.peek(1).v===")"){ this.next(); break; }
      const t=this.parseType();
      let nm=null;
      if(this.cur.t==="id") nm=this.next().v;
      if(this.eatOp("[")) this.expect("op","]");
      ps.push({type:t,name:nm});
      if(!this.eatOp(",")) break;
    }
    this.expect("op",")");
    return ps;
  }
  finishVarDecl(type,firstName,ln,global){
    const items=[];
    let name=firstName;
    for(;;){
      let arr=false, arrSize=null, init=null, ctor=null;
      if(this.isOp("[")){
        arr=true; this.next();
        if(!this.isOp("]")) arrSize=this.parseExpr();
        this.expect("op","]");
      }
      if(this.isId("PROGMEM")) this.next();
      if(this.isOp("(")){                       // object ctor  Adafruit_SSD1306 d(...)
        ctor=this.parseArgs();
      } else if(this.eatOp("=")){
        init = this.isOp("{") ? this.parseInitList() : this.parseAssign();
      }
      items.push({name,arr,arrSize,init,ctor});
      if(this.eatOp(",")){
        while(this.eatOp("*")){}
        name=this.expect("id").v;
        continue;
      }
      break;
    }
    this.expect("op",";");
    return {k:"var",type,items,line:ln,global:!!global};
  }
  parseInitList(){
    this.expect("op","{");
    const el=[];
    while(!this.isOp("}")){
      el.push(this.isOp("{")?this.parseInitList():this.parseAssign());
      if(!this.eatOp(",")) break;
    }
    this.expect("op","}");
    return {k:"initlist",el};
  }
  parseArgs(){
    this.expect("op","(");
    const a=[];
    while(!this.isOp(")")){
      a.push(this.parseAssign());
      if(!this.eatOp(",")) break;
    }
    this.expect("op",")");
    return a;
  }

  /* --- statements --- */
  parseBlock(){
    const ln=this.line;
    this.expect("op","{");
    const body=[];
    while(!this.isOp("}")){
      if(this.is("eof")) throw new CompileError("expected '}' at end of input", ln);
      body.push(this.parseStmt());
    }
    this.expect("op","}");
    return {k:"block",body,line:ln};
  }
  parseStmt(){
    const ln=this.line;
    if(this.isOp("{")) return this.parseBlock();
    if(this.eatOp(";")) return {k:"empty",line:ln};
    if(this.cur.t==="id"){
      switch(this.cur.v){
        case "if":       return this.parseIf();
        case "for":      return this.parseFor();
        case "while":    return this.parseWhile();
        case "do":       return this.parseDo();
        case "switch":   return this.parseSwitch();
        case "return": { this.next(); let e=null; if(!this.isOp(";")) e=this.parseExpr(); this.expect("op",";"); return {k:"return",e,line:ln}; }
        case "break":    this.next(); this.expect("op",";"); return {k:"break",line:ln};
        case "continue": this.next(); this.expect("op",";"); return {k:"continue",line:ln};
      }
      if(this.atType()){
        const save=this.p;
        try{
          const t=this.parseType();
          if(this.cur.t==="id"){
            const nm=this.next().v;
            if(!this.isOp("(") || /^[A-Z]/.test(t.raw)) return this.finishVarDecl(t,nm,ln,false);
          }
          this.p=save;
        }catch(e){ this.p=save; if(e instanceof CompileError && this.p===save){} else throw e; }
      }
    }
    const e=this.parseExpr();
    this.expect("op",";");
    return {k:"expr",e,line:ln};
  }
  parseIf(){
    const ln=this.line; this.next();
    this.expect("op","("); const c=this.parseExpr(); this.expect("op",")");
    const th=this.parseStmt();
    let el=null;
    if(this.isId("else")){ this.next(); el=this.parseStmt(); }
    return {k:"if",c,th,el,line:ln};
  }
  parseWhile(){
    const ln=this.line; this.next();
    this.expect("op","("); const c=this.parseExpr(); this.expect("op",")");
    const b=this.parseStmt();
    return {k:"while",c,b,line:ln};
  }
  parseDo(){
    const ln=this.line; this.next();
    const b=this.parseStmt();
    if(!this.isId("while")) throw new CompileError("expected 'while' after do-statement", this.line);
    this.next(); this.expect("op","("); const c=this.parseExpr(); this.expect("op",")"); this.expect("op",";");
    return {k:"do",c,b,line:ln};
  }
  parseFor(){
    const ln=this.line; this.next();
    this.expect("op","(");
    let init=null;
    if(!this.isOp(";")){
      if(this.atType()){
        const t=this.parseType(); const nm=this.expect("id").v;
        init=this.finishVarDecl(t,nm,ln,false);   // consumes ';'
      } else { init={k:"expr",e:this.parseExpr(),line:ln}; this.expect("op",";"); }
    } else this.next();
    let cond=null;
    if(!this.isOp(";")) cond=this.parseExpr();
    this.expect("op",";");
    let step=null;
    if(!this.isOp(")")) step=this.parseExpr();
    this.expect("op",")");
    const b=this.parseStmt();
    return {k:"for",init,cond,step,b,line:ln};
  }
  parseSwitch(){
    const ln=this.line; this.next();
    this.expect("op","("); const d=this.parseExpr(); this.expect("op",")");
    this.expect("op","{");
    const cases=[];
    while(!this.isOp("}")){
      if(this.isId("case")){
        this.next(); const v=this.parseExpr(); this.expect("op",":");
        cases.push({test:v,body:[]});
      } else if(this.isId("default")){
        this.next(); this.expect("op",":");
        cases.push({test:null,body:[]});
      } else {
        if(!cases.length) throw new CompileError("expected 'case' label", this.line);
        cases[cases.length-1].body.push(this.parseStmt());
      }
    }
    this.expect("op","}");
    return {k:"switch",d,cases,line:ln};
  }

  /* --- expressions --- */
  parseExpr(){
    let e=this.parseAssign();
    while(this.isOp(",")){ this.next(); const r=this.parseAssign(); e={k:"comma",l:e,r,line:e.line}; }
    return e;
  }
  parseAssign(){
    const l=this.parseCond();
    const ops=["=","+=","-=","*=","/=","%=","&=","|=","^=","<<=",">>="];
    if(this.cur.t==="op"&&ops.includes(this.cur.v)){
      const op=this.next().v;
      const r=this.parseAssign();
      return {k:"assign",op,l,r,line:l.line};
    }
    return l;
  }
  parseCond(){
    const c=this.parseBin(0);
    if(this.isOp("?")){
      this.next(); const a=this.parseAssign(); this.expect("op",":"); const b=this.parseAssign();
      return {k:"cond",c,a,b,line:c.line};
    }
    return c;
  }
  binOps(lv){
    return [["||"],["&&"],["|"],["^"],["&"],["==","!="],["<",">","<=",">="],["<<",">>"],["+","-"],["*","/","%"]][lv];
  }
  parseBin(lv){
    if(lv>9) return this.parseUnary();
    let l=this.parseBin(lv+1);
    for(;;){
      let op=null;
      if(this.cur.t==="op"&&this.binOps(lv).includes(this.cur.v)) op=this.cur.v;
      else if(this.cur.t==="id"&&lv===0&&this.cur.v==="or") op="||";
      else if(this.cur.t==="id"&&lv===1&&this.cur.v==="and") op="&&";
      if(!op) break;
      this.next();
      const r=this.parseBin(lv+1);
      l={k:"bin",op,l,r,line:l.line};
    }
    return l;
  }
  parseUnary(){
    const ln=this.line;
    if(this.cur.t==="op"&&["!","-","+","~","&","*"].includes(this.cur.v)){
      const op=this.next().v; const e=this.parseUnary();
      return {k:"un",op,e,line:ln};
    }
    if(this.cur.t==="id"&&this.cur.v==="not"){ this.next(); return {k:"un",op:"!",e:this.parseUnary(),line:ln}; }
    if(this.cur.t==="op"&&["++","--"].includes(this.cur.v)){
      const op=this.next().v; const e=this.parseUnary();
      return {k:"pre",op,e,line:ln};
    }
    if(this.isId("sizeof")){
      this.next();
      if(this.isOp("(")){ this.next(); let d=1;
        while(d>0){ if(this.isOp("(")) d++; if(this.isOp(")")) d--; if(d>0) this.next(); }
        this.expect("op",")"); }
      return {k:"num",v:4,f:false,line:ln};
    }
    // cast : (float)x
    if(this.isOp("(") && this.peek(1).t==="id" && PRIMS.has(this.peek(1).v)){
      const save=this.p;
      this.next();
      const t=this.parseType();
      if(this.isOp(")")){ this.next(); return {k:"cast",type:t,e:this.parseUnary(),line:ln}; }
      this.p=save;
    }
    return this.parsePostfix();
  }
  parsePostfix(){
    let e=this.parsePrimary();
    for(;;){
      if(this.isOp("(")){ e={k:"call",callee:e,args:this.parseArgs(),line:e.line}; }
      else if(this.isOp("[")){ this.next(); const i=this.parseExpr(); this.expect("op","]"); e={k:"index",o:e,i,line:e.line}; }
      else if(this.isOp(".")||this.isOp("->")){ this.next(); const n=this.expect("id").v; e={k:"member",o:e,n,line:e.line}; }
      else if(this.isOp("++")||this.isOp("--")){ const op=this.next().v; e={k:"post",op,e,line:e.line}; }
      else if(this.isOp("::")){ this.next(); const n=this.expect("id").v; e={k:"id",v:n,line:e.line}; }
      else break;
    }
    return e;
  }
  parsePrimary(){
    const ln=this.line, c=this.cur;
    if(c.t==="num"){ this.next(); return {k:"num",v:c.v.v,f:c.v.f,line:ln}; }
    if(c.t==="str"){ this.next();
      let s=c.v;
      while(this.cur.t==="str"){ s+=this.next().v; }        // "a" "b"
      return {k:"str",v:s,line:ln}; }
    if(c.t==="char"){ this.next(); return {k:"chr",v:c.v,line:ln}; }
    if(c.t==="id"){ this.next(); return {k:"id",v:c.v,line:ln}; }
    if(this.isOp("(")){ this.next(); const e=this.parseExpr(); this.expect("op",")"); return e; }
    if(this.isOp("{")) return this.parseInitList();
    throw new CompileError("expected primary-expression before '"+
      (c.t==="eof"?"end of file":String(c.v))+"'", ln);
  }
}


/* =========================================================================
   HARDWARE RUNTIME — pins / RGB / relays / OLED / buzzer / SHT31 / WiFi
   ========================================================================= */
const PIN = { R:25, G:26, B:27, BTN_A:0, BTN_B:4, RELAY1:32, RELAY2:14, BUZZER:33, VR:36 };

const HW = {
  t0:0, speed:1,
  pinMode:{}, pinVal:{}, pwm:{},          // pwm[pin] = duty 0..255 (null = digital)
  adcBits:12,
  btnA:false, btnB:false,
  ledc:{},                                 // channel -> {freq,res,pin,duty}
  toneFreq:0,
  serialBaud:0, serialOpen:false, rx:[],
  wifi:{ mode:1, ssid:"", pass:"", tStart:0, connected:false, beganAt:-1 },
  dirty:true,

  millis(){ return Math.floor((performance.now()-this.t0)*this.speed); },
  micros(){ return Math.floor((performance.now()-this.t0)*this.speed*1000); },

  reset(){
    this.t0=performance.now();
    this.pinMode={}; this.pinVal={}; this.pwm={}; this.ledc={};
    this.adcBits=12; this.serialBaud=0; this.serialOpen=false; this.rx=[];
    this.wifi={ mode:1, ssid:"", pass:"", tStart:0, connected:false, beganAt:-1 };
    this.setTone(0);
    OLED.reset();
    this.dirty=true;
  },

  digitalWrite(p,v){
    this.pinVal[p]= v?1:0; this.pwm[p]=null; this.dirty=true;
    if(p===PIN.BUZZER) this.setTone(0);
  },
  digitalRead(p){
    if(p===PIN.BTN_A) return this.btnA?0:1;         // active LOW
    if(p===PIN.BTN_B) return this.btnB?0:1;
    return this.pinVal[p]??1;
  },
  analogRead(p){
    const max=(1<<this.adcBits)-1;
    if(p===PIN.VR||p===39||p===34||p===35){
      const raw = +UI.el.adcR.value;                // 0..4095
      return Math.round(raw/4095*max);
    }
    return 0;
  },
  analogWrite(p,d){ this.pwm[p]=Math.max(0,Math.min(255,d)); this.dirty=true; },

  /* ---- LEDC (ESP32 PWM) ---- */
  ledcSetup(ch,freq,res){ this.ledc[ch]=Object.assign(this.ledc[ch]||{},{freq,res,pin:this.ledc[ch]?.pin??null}); return freq; },
  ledcAttachPin(pin,ch){ this.ledc[ch]=Object.assign(this.ledc[ch]||{freq:5000,res:8},{pin}); },
  ledcAttach(pin,freq,res){ this.ledc[pin]=Object.assign(this.ledc[pin]||{},{freq,res,pin}); return freq; },
  ledcDetachPin(pin){
    for(const k in this.ledc) if(this.ledc[k].pin===pin) this.ledc[k].pin=null;
    this.pwm[pin]=null;
    if(pin===PIN.BUZZER) this.setTone(0);
    this.dirty=true;
  },
  ledcWrite(ch,duty){
    const c=this.ledc[ch]; if(!c||c.pin==null) return;
    const res=c.res||8, max=(1<<res)-1;
    const d=Math.round(Math.max(0,Math.min(max,duty))/max*255);
    if(c.pin===PIN.BUZZER){ this.setTone(d>0?(c.freq||2000):0); return; }
    this.pwm[c.pin]=d; this.dirty=true;
  },
  ledcWriteTone(ch,freq){
    const c=this.ledc[ch]; if(!c) return 0;
    c.freq=freq;
    if(c.pin===PIN.BUZZER||c.pin==null) this.setTone(freq);
    else { this.pwm[c.pin]= freq>0?128:255; this.dirty=true; }
    return freq;
  },
  ledcWriteNote(ch,note,octave){
    const f = 440*Math.pow(2,(note + (octave-4)*12 - 9)/12);
    return this.ledcWriteTone(ch,Math.round(f));
  },
  setTone(f){
    this.toneFreq=f>0?f:0;
    Audio_.set(this.toneFreq);
    this.dirty=true;
  },

  /* ---- sensors ---- */
  shtOk(){ return UI.el.shtOn.checked; },
  temp(){ return +UI.el.tempR.value + (Math.random()-0.5)*0.04; },
  hum(){  return +UI.el.humR.value  + (Math.random()-0.5)*0.08; },

  /* ---- wifi ---- */
  wifiBegin(ssid,pass){
    this.wifi.ssid=ssid; this.wifi.pass=pass;
    this.wifi.beganAt=this.millis(); this.wifi.connected=false;
    this.dirty=true;
  },
  wifiStatus(){
    const w=this.wifi;
    if(w.beganAt<0) return 0;                            // WL_IDLE_STATUS
    const on=UI.el.apOn.checked;
    const okSsid = w.ssid===UI.el.apSsid.value;
    const okPass = w.pass===UI.el.apPass.value;
    if(!on) return 6;                                    // WL_DISCONNECTED
    if(!okSsid) return 6;
    if(!okPass) return 4;                                // WL_CONNECT_FAILED (keeps retrying)
    if(this.millis()-w.beganAt < +UI.el.apDelay.value) return 6;
    if(!w.connected){ w.connected=true; this.dirty=true; }
    return 3;                                            // WL_CONNECTED
  },
  wifiIP(){ return this.wifiStatus()===3 ? "192.168.1.87" : "0.0.0.0"; },

  /* ---- visual helpers ---- */
  chanLevel(pin){                    // 0..1 brightness (common anode)
    if(this.pwm[pin]!=null) return 1-this.pwm[pin]/255;
    return (this.pinVal[pin]??1)===0 ? 1 : 0;
  }
};

/* ---------------- audio ---------------- */
const Audio_ = {
  ctx:null, osc:null, gain:null, cur:0,
  init(){
    if(this.ctx) return;
    try{
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.gain=this.ctx.createGain(); this.gain.gain.value=0;
      this.osc=this.ctx.createOscillator(); this.osc.type="square";
      this.osc.frequency.value=440;
      this.osc.connect(this.gain); this.gain.connect(this.ctx.destination);
      this.osc.start();
    }catch(e){ this.ctx=null; }
  },
  set(f){
    this.cur=f;
    if(!this.ctx){ if(f>0) this.init(); else return; }
    if(!this.ctx) return;
    if(this.ctx.state==="suspended") this.ctx.resume();
    const t=this.ctx.currentTime;
    if(f>0){ this.osc.frequency.setValueAtTime(Math.max(40,Math.min(12000,f)),t);
             this.gain.gain.setTargetAtTime(0.05,t,0.005); }
    else   { this.gain.gain.setTargetAtTime(0,t,0.005); }
  }
};

/* ---------------- OLED SSD1306 ---------------- */
const OLED = {
  W:128,H:64,
  buf:new Uint8Array(128*64), shown:new Uint8Array(128*64),
  init:false, cx:0, cy:0, size:1, color:1, bg:null, wrap:true, inv:false,
  glyphs:{},
  reset(){ this.buf.fill(0); this.shown.fill(0); this.init=false;
    this.cx=0;this.cy=0;this.size=1;this.color=1;this.bg=null;this.wrap=true;this.inv=false;
    this.paint(); },
  px(x,y,c){
    x|=0;y|=0;
    if(x<0||y<0||x>=this.W||y>=this.H) return;
    const i=y*this.W+x;
    if(c===2) this.buf[i]=this.buf[i]?0:1;
    else this.buf[i]= c?1:0;
  },
  fillScreen(c){ this.buf.fill(c?1:0); },
  hLine(x,y,w,c){ for(let i=0;i<w;i++) this.px(x+i,y,c); },
  vLine(x,y,h,c){ for(let i=0;i<h;i++) this.px(x,y+i,c); },
  line(x0,y0,x1,y1,c){
    x0|=0;y0|=0;x1|=0;y1|=0;
    const dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0);
    const sx=x0<x1?1:-1, sy=y0<y1?1:-1;
    let err=dx+dy;
    for(;;){
      this.px(x0,y0,c);
      if(x0===x1&&y0===y1) break;
      const e2=2*err;
      if(e2>=dy){ err+=dy; x0+=sx; }
      if(e2<=dx){ err+=dx; y0+=sy; }
    }
  },
  rect(x,y,w,h,c){ this.hLine(x,y,w,c); this.hLine(x,y+h-1,w,c); this.vLine(x,y,h,c); this.vLine(x+w-1,y,h,c); },
  fillRect(x,y,w,h,c){ for(let j=0;j<h;j++) this.hLine(x,y+j,w,c); },
  roundRect(x,y,w,h,r,c){ this.rect(x,y,w,h,c); },
  fillRoundRect(x,y,w,h,r,c){ this.fillRect(x,y,w,h,c); },
  circle(x0,y0,r,c){
    let f=1-r,ddF_x=1,ddF_y=-2*r,x=0,y=r;
    this.px(x0,y0+r,c);this.px(x0,y0-r,c);this.px(x0+r,y0,c);this.px(x0-r,y0,c);
    while(x<y){
      if(f>=0){y--;ddF_y+=2;f+=ddF_y;}
      x++;ddF_x+=2;f+=ddF_x;
      this.px(x0+x,y0+y,c);this.px(x0-x,y0+y,c);this.px(x0+x,y0-y,c);this.px(x0-x,y0-y,c);
      this.px(x0+y,y0+x,c);this.px(x0-y,y0+x,c);this.px(x0+y,y0-x,c);this.px(x0-y,y0-x,c);
    }
  },
  fillCircle(x0,y0,r,c){
    for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++) if(x*x+y*y<=r*r+r*0.5) this.px(x0+x,y0+y,c);
  },
  triangle(a,b,c2,d,e,f,c){ this.line(a,b,c2,d,c); this.line(c2,d,e,f,c); this.line(e,f,a,b,c); },
  fillTriangle(x0,y0,x1,y1,x2,y2,c){
    const minx=Math.min(x0,x1,x2),maxx=Math.max(x0,x1,x2);
    const miny=Math.min(y0,y1,y2),maxy=Math.max(y0,y1,y2);
    const area=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
    if(area===0){ this.line(x0,y0,x1,y1,c); return; }
    for(let y=miny;y<=maxy;y++) for(let x=minx;x<=maxx;x++){
      const w0=((x1-x0)*(y-y0)-(x-x0)*(y1-y0))/area;
      const w1=((x2-x1)*(y-y1)-(x-x1)*(y2-y1))/area;
      const w2=((x0-x2)*(y-y2)-(x-x2)*(y0-y2))/area;
      if(w0>=-0.001&&w1>=-0.001&&w2>=-0.001) this.px(x,y,c);
    }
  },
  bitmap(x,y,bytes,w,h,c){
    const bw=Math.floor((w+7)/8);
    for(let j=0;j<h;j++) for(let i=0;i<w;i++){
      const b=bytes[j*bw+(i>>3)]||0;
      if(b & (0x80>>(i&7))) this.px(x+i,y+j,c);
    }
  },
  fontMode:null,
  renderGlyph(ch,S){
    const cv=document.createElement("canvas");
    cv.width=6*S; cv.height=8*S;
    const g=cv.getContext("2d",{willReadFrequently:true});
    g.clearRect(0,0,cv.width,cv.height);
    g.fillStyle="#fff"; g.textBaseline="top";
    g.font=(8*S)+'px "Courier New",Consolas,monospace';
    g.fillText(ch,0,0);
    const d=g.getImageData(0,0,cv.width,cv.height).data, rows=[];
    for(let y=0;y<8;y++){
      let r=0;
      for(let x=0;x<6;x++){
        let sum=0;
        for(let j=0;j<S;j++) for(let i=0;i<S;i++)
          sum += d[(((y*S+j)*cv.width)+(x*S+i))*4+3];
        if(sum/(S*S) > (S===1?96:86)) r|=(1<<x);
      }
      rows.push(r);
    }
    return rows;
  },
  ink(rows){ let n=0; for(const r of rows) for(let i=0;i<6;i++) if((r>>i)&1) n++; return n; },
  glyph(ch){
    if(this.glyphs[ch]) return this.glyphs[ch];
    if(this.fontMode===null){
      try{
        const a=this.renderGlyph("A",1), b=this.renderGlyph("8",1);
        this.fontMode = (this.ink(a)>=7 && this.ink(b)>=8) ? 1 : 4;
      }catch(e){ this.fontMode=4; }
    }
    let rows;
    try{ rows=this.renderGlyph(ch,this.fontMode); }catch(e){ rows=[0,0,0,0,0,0,0,0]; }
    this.glyphs[ch]=rows; return rows;
  },
  drawChar(x,y,ch,color,bg,size){
    if(ch===" "&&bg==null) return;
    const g=this.glyph(ch);
    for(let yy=0;yy<8;yy++) for(let xx=0;xx<6;xx++){
      const on=(g[yy]>>xx)&1;
      if(on) size===1 ? this.px(x+xx,y+yy,color) : this.fillRect(x+xx*size,y+yy*size,size,size,color);
      else if(bg!=null) size===1 ? this.px(x+xx,y+yy,bg) : this.fillRect(x+xx*size,y+yy*size,size,size,bg);
    }
  },
  write(ch){
    if(ch==="\n"){ this.cy+=8*this.size; this.cx=0; return; }
    if(ch==="\r") return;
    if(this.wrap && this.cx+6*this.size>this.W){ this.cx=0; this.cy+=8*this.size; }
    this.drawChar(this.cx,this.cy,ch,this.color,this.bg,this.size);
    this.cx+=6*this.size;
  },
  print(s){ for(const ch of String(s)) this.write(ch); },
  show(){ this.shown.set(this.buf); this.paint(); },
  paint(){
    const cv=HOST.canvas;
    if(!cv) return;
    const g=cv.getContext("2d");
    const img=g.createImageData(this.W,this.H);
    const on=[232,246,255,255], off=[6,10,16,255];
    for(let i=0;i<this.W*this.H;i++){
      let v=this.init? this.shown[i] : 0;
      if(this.inv) v=v?0:1;
      const c=v?on:off;
      img.data[i*4]=c[0]; img.data[i*4+1]=c[1]; img.data[i*4+2]=c[2]; img.data[i*4+3]=255;
    }
    g.putImageData(img,0,0);
  }
};


/* =========================================================================
   VALUES + INTERPRETER
   ========================================================================= */
const VI=n=>({t:"int",v:Number.isFinite(n)?Math.trunc(n):0});
const VF=n=>({t:"float",v:n});
const VS=s=>({t:"str",v:String(s)});
const VC=c=>({t:"char",v:c});
const VOID={t:"void",v:0};
const VB=b=>({t:"int",v:b?1:0});

function num(x){
  if(x==null) return 0;
  if(x.t==="str") { const f=parseFloat(x.v); return Number.isFinite(f)?f:0; }
  if(x.t==="obj"||x.t==="arr") return 1;
  return x.v;
}
function truthy(x){
  if(x==null) return false;
  if(x.t==="str") return x.v.length>0;
  if(x.t==="obj"||x.t==="arr") return true;
  return num(x)!==0;
}
function fmtVal(x,arg){
  if(x==null) return "";
  switch(x.t){
    case "float":{
      if(Number.isNaN(x.v)) return "nan";
      if(!Number.isFinite(x.v)) return x.v>0?"inf":"-inf";
      const d = (arg!=null&&Number.isFinite(arg))?Math.max(0,Math.min(10,arg)):2;
      return x.v.toFixed(d);
    }
    case "int":{
      if(arg===16) return (x.v>>>0).toString(16).toUpperCase();
      if(arg===2)  return (x.v>>>0).toString(2);
      if(arg===8)  return (x.v>>>0).toString(8);
      return String(x.v);
    }
    case "char": return String.fromCharCode(x.v);
    case "str":  return x.v;
    case "obj":  return x.v.cls==="IP" ? x.v.ip : ("<"+x.v.cls+">");
    case "arr":  return "[array]";
    default: return "";
  }
}
function coerce(val,type){
  switch(type){
    case "int":   return VI(num(val));
    case "float": return VF(num(val));
    case "bool":  return VI(truthy(val)?1:0);
    case "char":  return val.t==="str" ? VC(val.v.charCodeAt(0)||0) : VC(Math.trunc(num(val)));
    case "str":   return VS(fmtVal(val));
    default:      return val;
  }
}
function typeOfDecl(raw,ptr){
  const t=(raw||"").replace(/\b(const|static|volatile|extern|inline)\b/g,"").trim();
  if(ptr>0) return /char/.test(t) ? "str" : "int";
  if(/String/.test(t)) return "str";
  if(/(float|double)/.test(t)) return "float";
  if(/\bchar\b/.test(t)&&!/unsigned|uint8/.test(t)) return "char";
  if(/(int|long|short|byte|bool|boolean|size_t|word|uint|int8|int16|int32)/.test(t)) return "int";
  if(/void/.test(t)) return "void";
  return "obj";
}

/* ---------------- constants ---------------- */
const CONSTS={
  HIGH:1,LOW:0,INPUT:1,OUTPUT:3,INPUT_PULLUP:5,INPUT_PULLDOWN:9,
  true:1,false:0,LED_BUILTIN:2,PI:Math.PI,M_PI:Math.PI,HALF_PI:Math.PI/2,TWO_PI:Math.PI*2,
  DEC:10,HEX:16,OCT:8,BIN:2,
  WHITE:1,BLACK:0,INVERSE:2,SSD1306_WHITE:1,SSD1306_BLACK:0,SSD1306_INVERSE:2,
  SSD1306_SWITCHCAPVCC:2,SSD1306_EXTERNALVCC:1,
  WL_IDLE_STATUS:0,WL_NO_SSID_AVAIL:1,WL_SCAN_COMPLETED:2,WL_CONNECTED:3,
  WL_CONNECT_FAILED:4,WL_CONNECTION_LOST:5,WL_DISCONNECTED:6,
  WIFI_OFF:0,WIFI_STA:1,WIFI_AP:2,WIFI_AP_STA:3,
  NOTE_C:0,NOTE_Cs:1,NOTE_D:2,NOTE_Eb:3,NOTE_E:4,NOTE_F:5,NOTE_Fs:6,
  NOTE_G:7,NOTE_Gs:8,NOTE_A:9,NOTE_Bb:10,NOTE_B:11,NOTE_MAX:12,
  A0:36,A3:39,A6:34,A7:35,
  LSBFIRST:0,MSBFIRST:1,CHANGE:1,FALLING:2,RISING:3,
};
CONSTS.NAN=NaN;

const BUILTIN_FUNCS=new Set(["pinMode","digitalWrite","digitalRead","analogRead","analogWrite",
 "analogReadResolution","analogWriteResolution","delay","delayMicroseconds","millis","micros",
 "map","constrain","min","max","abs","pow","sqrt","sq","random","randomSeed","sin","cos","tan",
 "floor","ceil","round","fabs","log","log10","exp","isnan","isinf","String","F","PSTR",
 "pgm_read_byte","pgm_read_word","pgm_read_byte_near","ledcSetup","ledcAttachPin","ledcAttach","ledcDetachPin",
 "ledcWrite","ledcWriteTone","ledcWriteNote","ledcRead","ledcReadFreq","tone","noTone","yield",
 "esp_random","setup","loop","char","byte","int","float","word","long","exit","strlen","strcmp",
 "attachInterrupt","detachInterrupt","digitalPinToInterrupt","noInterrupts","interrupts",
 "Adafruit_SSD1306","Adafruit_SHT31","IPAddress","dtostrf","sprintf","snprintf"]);
const BUILTIN_OBJS=new Set(["Serial","Serial1","Serial2","Wire","SPI","WiFi","ESP","EEPROM"]);

/* ---------------- serial console ---------------- */
const SER={
  line:"",
  out(s){
    for(const ch of s){
      if(ch==="\n"){ UI.serialLine(this.line); this.line=""; }
      else if(ch!=="\r") this.line+=ch;
    }
    UI.serialPartial(this.line);
  },
  clear(){ this.line=""; }
};

/* ---------------- interpreter ---------------- */
class Scope{
  constructor(p){ this.m=new Map(); this.p=p; }
  find(n){ let s=this; while(s){ if(s.m.has(n)) return s.m.get(n); s=s.p; } return null; }
  def(n,cell){ this.m.set(n,cell); }
}

class Interp{
  constructor(ast,includes){
    this.ast=ast; this.includes=includes;
    this.funcs=new Map(); this.g=new Scope(null); this.line=0;
  }
  err(msg){ throw new RuntimeErr(msg,this.line); }

  *initGlobals(){
    for(const d of this.ast) if(d.k==="func") this.funcs.set(d.name,d);
    for(const d of this.ast){
      if(d.k!=="var") continue;
      yield* this.declare(d,this.g);
    }
  }
  *declare(d,env){
    const dt=typeOfDecl(d.type.raw,d.type.ptr);
    for(const it of d.items){
      this.line=d.line;
      if(it.ctor!==null&&it.ctor!==undefined){
        const args=[]; for(const a of it.ctor) args.push(yield* this.ev(a,env));
        env.def(it.name,{type:"obj",val:this.construct(d.type.raw,args)});
        continue;
      }
      if(it.arr){
        let arr=[];
        if(it.init&&it.init.k==="initlist"){
          for(const e of it.init.el){
            if(e.k==="initlist"){ for(const e2 of e.el) arr.push(num(yield* this.ev(e2,env))); }
            else{
              const v=yield* this.ev(e,env);
              if(v.t==="str"){ for(const c of v.v) arr.push(c.charCodeAt(0)); arr.push(0); }
              else arr.push(num(v));
            }
          }
        } else if(it.init){
          const v=yield* this.ev(it.init,env);
          if(v.t==="str"){ for(const c of v.v) arr.push(c.charCodeAt(0)); arr.push(0); }
          else if(v.t==="arr") arr=v.v.slice();
        }
        if(it.arrSize){
          const n=num(yield* this.ev(it.arrSize,env));
          while(arr.length<n) arr.push(0);
        }
        env.def(it.name,{type:"arr",val:{t:"arr",v:arr}});
        continue;
      }
      let val;
      if(it.init) val=coerce(yield* this.ev(it.init,env),dt);
      else val = dt==="str"?VS(""):(dt==="float"?VF(0):(dt==="obj"?this.construct(d.type.raw,[]):VI(0)));
      env.def(it.name,{type:dt,val});
    }
  }
  construct(raw,args){
    const cls=raw.split(" ").pop();
    if(cls==="Adafruit_SSD1306") return {t:"obj",v:{cls:"SSD1306"}};
    if(cls==="Adafruit_SHT31")  return {t:"obj",v:{cls:"SHT31"}};
    if(cls==="IPAddress")       return {t:"obj",v:{cls:"IP",ip:args.length?args.map(a=>num(a)).join("."):"0.0.0.0"}};
    if(cls==="String")          return VS(args.length?fmtVal(args[0]):"");
    return {t:"obj",v:{cls}};
  }

  /* ---------- statements ---------- */
  *exec(s,env){
    this.line=s.line||this.line;
    switch(s.k){
      case "block":{
        const e2=new Scope(env);
        for(const st of s.body){ const r=yield* this.exec(st,e2); if(r) return r; }
        return null;
      }
      case "var": yield* this.declare(s,env); return null;
      case "expr": yield* this.ev(s.e,env); return null;
      case "empty": return null;
      case "if":
        if(truthy(yield* this.ev(s.c,env))) return yield* this.exec(s.th,env);
        else if(s.el) return yield* this.exec(s.el,env);
        return null;
      case "while":{
        let guard=0;
        while(truthy(yield* this.ev(s.c,env))){
          const r=yield* this.exec(s.b,env);
          if(r){ if(r.sig==="break") break; if(r.sig==="return") return r; }
          if(++guard%64===0) yield "tick"; else yield "tick";
        }
        return null;
      }
      case "do":{
        do{
          const r=yield* this.exec(s.b,env);
          if(r){ if(r.sig==="break") break; if(r.sig==="return") return r; }
          yield "tick";
        } while(truthy(yield* this.ev(s.c,env)));
        return null;
      }
      case "for":{
        const e2=new Scope(env);
        if(s.init) yield* this.exec(s.init,e2);
        for(;;){
          if(s.cond && !truthy(yield* this.ev(s.cond,e2))) break;
          const r=yield* this.exec(s.b,e2);
          if(r){ if(r.sig==="break") break; if(r.sig==="return") return r; }
          if(s.step) yield* this.ev(s.step,e2);
          yield "tick";
        }
        return null;
      }
      case "switch":{
        const d=yield* this.ev(s.d,env);
        const e2=new Scope(env);
        let start=-1;
        for(let i=0;i<s.cases.length;i++){
          const c=s.cases[i];
          if(c.test===null) continue;
          if(num(yield* this.ev(c.test,e2))===num(d)){ start=i; break; }
        }
        if(start<0) start=s.cases.findIndex(c=>c.test===null);
        if(start<0) return null;
        for(let i=start;i<s.cases.length;i++){
          for(const st of s.cases[i].body){
            const r=yield* this.exec(st,e2);
            if(r){ if(r.sig==="break") return null; return r; }
          }
        }
        return null;
      }
      case "return": return {sig:"return",val: s.e? (yield* this.ev(s.e,env)) : VOID};
      case "break": return {sig:"break"};
      case "continue": return {sig:"continue"};
      default: return null;
    }
  }

  /* ---------- expressions ---------- */
  *ev(n,env){
    if(!n) return VOID;
    this.line=n.line||this.line;
    switch(n.k){
      case "num": return n.f?VF(n.v):VI(n.v);
      case "str": return VS(n.v);
      case "chr": return VC(n.v);
      case "initlist":{ const a=[]; for(const e of n.el) a.push(num(yield* this.ev(e,env))); return {t:"arr",v:a}; }
      case "id":{
        const c=env.find(n.v);
        if(c) return c.val;
        if(Object.prototype.hasOwnProperty.call(CONSTS,n.v)){
          const v=CONSTS[n.v];
          return Number.isInteger(v)?VI(v):VF(v);
        }
        if(BUILTIN_OBJS.has(n.v)) return {t:"obj",v:{cls:n.v}};
        this.err("'"+n.v+"' was not declared in this scope");
      }
      case "comma": yield* this.ev(n.l,env); return yield* this.ev(n.r,env);
      case "cast": return coerce(yield* this.ev(n.e,env), typeOfDecl(n.type.raw));
      case "cond": return truthy(yield* this.ev(n.c,env)) ? yield* this.ev(n.a,env) : yield* this.ev(n.b,env);
      case "un":{
        if(n.op==="&"||n.op==="*") return yield* this.ev(n.e,env);
        const v=yield* this.ev(n.e,env);
        if(n.op==="!") return VB(!truthy(v));
        if(n.op==="-") return v.t==="float"?VF(-num(v)):VI(-num(v));
        if(n.op==="+") return v;
        if(n.op==="~") return VI(~num(v));
        return v;
      }
      case "pre":{
        const cur=yield* this.ev(n.e,env);
        const nv = cur.t==="float"?VF(num(cur)+(n.op==="++"?1:-1)):VI(num(cur)+(n.op==="++"?1:-1));
        yield* this.store(n.e,nv,env); return nv;
      }
      case "post":{
        const cur=yield* this.ev(n.e,env);
        const nv = cur.t==="float"?VF(num(cur)+(n.op==="++"?1:-1)):VI(num(cur)+(n.op==="++"?1:-1));
        yield* this.store(n.e,nv,env); return cur;
      }
      case "bin":{
        const op=n.op;
        if(op==="&&"){ if(!truthy(yield* this.ev(n.l,env))) return VB(false); return VB(truthy(yield* this.ev(n.r,env))); }
        if(op==="||"){ if(truthy(yield* this.ev(n.l,env))) return VB(true); return VB(truthy(yield* this.ev(n.r,env))); }
        const a=yield* this.ev(n.l,env), b=yield* this.ev(n.r,env);
        return this.binop(op,a,b);
      }
      case "assign":{
        let val;
        if(n.op==="="){ val=yield* this.ev(n.r,env); }
        else{
          const cur=yield* this.ev(n.l,env);
          const r=yield* this.ev(n.r,env);
          val=this.binop(n.op.slice(0,-1),cur,r);
        }
        return yield* this.store(n.l,val,env);
      }
      case "index":{
        const o=yield* this.ev(n.o,env);
        const i=num(yield* this.ev(n.i,env));
        if(o.t==="arr") return VI(o.v[i]??0);
        if(o.t==="str") return VC(o.v.charCodeAt(i)||0);
        return VI(0);
      }
      case "member":{
        const o=yield* this.ev(n.o,env);
        if(o.t==="obj"&&o.v.cls==="IP") return VS(o.v.ip);
        return o;
      }
      case "call": return yield* this.call(n,env);
    }
    return VOID;
  }
  binop(op,a,b){
    if(op==="+"&&(a.t==="str"||b.t==="str")) return VS(fmtVal(a)+fmtVal(b));
    if((a.t==="str"||b.t==="str")&&(op==="=="||op==="!=")){
      const eq=fmtVal(a)===fmtVal(b); return VB(op==="=="?eq:!eq);
    }
    const x=num(a), y=num(b);
    const isF = a.t==="float"||b.t==="float";
    switch(op){
      case "+": return isF?VF(x+y):VI(x+y);
      case "-": return isF?VF(x-y):VI(x-y);
      case "*": return isF?VF(x*y):VI(x*y);
      case "/":
        if(!isF){ if(y===0) return VI(0); return VI(Math.trunc(x/y)); }
        return VF(x/y);
      case "%": return y===0?VI(0):VI(x%y);
      case "==": return VB(x===y);
      case "!=": return VB(x!==y);
      case "<":  return VB(x<y);
      case ">":  return VB(x>y);
      case "<=": return VB(x<=y);
      case ">=": return VB(x>=y);
      case "&":  return VI(x&y);
      case "|":  return VI(x|y);
      case "^":  return VI(x^y);
      case "<<": return VI(x<<y);
      case ">>": return VI(x>>y);
    }
    return VI(0);
  }
  *store(target,val,env){
    if(target.k==="id"){
      const c=env.find(target.v);
      if(!c) this.err("'"+target.v+"' was not declared in this scope");
      c.val=coerce(val,c.type);
      return c.val;
    }
    if(target.k==="index"){
      const o=yield* this.ev(target.o,env);
      const i=num(yield* this.ev(target.i,env));
      if(o.t==="arr"){ o.v[i]=num(val); return VI(o.v[i]); }
      return val;
    }
    this.err("lvalue required as left operand of assignment");
  }

  /* ---------- calls ---------- */
  *call(n,env){
    const c=n.callee;
    if(c.k==="member"){
      const objNode=c.o;
      let objv;
      if(objNode.k==="id"&&!env.find(objNode.v)&&BUILTIN_OBJS.has(objNode.v)) objv={t:"obj",v:{cls:objNode.v}};
      else objv=yield* this.ev(objNode,env);
      const args=[]; for(const a of n.args) args.push(yield* this.ev(a,env));
      return this.hostCall(objv,c.n,args,n);
    }
    if(c.k!=="id") this.err("expression is not callable");
    const name=c.v;
    const fn=this.funcs.get(name);
    if(fn){
      const args=[]; for(const a of n.args) args.push(yield* this.ev(a,env));
      return yield* this.invoke(fn,args);
    }
    return yield* this.builtin(name,n,env);
  }
  *invoke(fn,args){
    const e=new Scope(this.g);
    fn.params.forEach((p,i)=>{
      if(!p.name) return;
      const dt=typeOfDecl(p.type.raw,p.type.ptr);
      const a=args[i]??VI(0);
      e.def(p.name,{type: a.t==="arr"?"arr":dt, val: a.t==="arr"?a:coerce(a,dt)});
    });
    const r=yield* this.exec(fn.body,e);
    const ret=typeOfDecl(fn.ret.raw);
    if(r&&r.sig==="return") return ret==="void"?VOID:coerce(r.val,ret);
    return VOID;
  }
  *builtin(name,n,env){
    const A=[]; for(const a of n.args) A.push(yield* this.ev(a,env));
    const N=i=>num(A[i]);
    switch(name){
      case "delay":{
        const ms=Math.max(0,N(0));
        yield {sleep:ms};
        return VOID;
      }
      case "delayMicroseconds": yield {sleep:N(0)/1000}; return VOID;
      case "yield": yield "tick"; return VOID;
      case "pinMode": HW.pinMode[N(0)]=N(1); if(!(N(0) in HW.pinVal)) HW.pinVal[N(0)]=1; HW.dirty=true; return VOID;
      case "digitalWrite": HW.digitalWrite(N(0),N(1)); return VOID;
      case "digitalRead": return VI(HW.digitalRead(N(0)));
      case "analogRead": return VI(HW.analogRead(N(0)));
      case "analogWrite": HW.analogWrite(N(0),N(1)); return VOID;
      case "analogReadResolution": HW.adcBits=N(0); return VOID;
      case "analogWriteResolution": return VOID;
      case "millis": return VI(HW.millis());
      case "micros": return VI(HW.micros());
      case "map":{
        const [v,a,b,c,d]=[N(0),N(1),N(2),N(3),N(4)];
        if(b-a===0) return VI(c);
        return VI(Math.trunc((v-a)*(d-c)/(b-a)+c));
      }
      case "constrain":{ const v=N(0); return A[0].t==="float"?VF(Math.min(Math.max(v,N(1)),N(2))):VI(Math.min(Math.max(v,N(1)),N(2))); }
      case "min": return (A[0].t==="float"||A[1].t==="float")?VF(Math.min(N(0),N(1))):VI(Math.min(N(0),N(1)));
      case "max": return (A[0].t==="float"||A[1].t==="float")?VF(Math.max(N(0),N(1))):VI(Math.max(N(0),N(1)));
      case "abs": return A[0].t==="float"?VF(Math.abs(N(0))):VI(Math.abs(N(0)));
      case "fabs": return VF(Math.abs(N(0)));
      case "pow": return VF(Math.pow(N(0),N(1)));
      case "sqrt": return VF(Math.sqrt(N(0)));
      case "sq": return VF(N(0)*N(0));
      case "sin": return VF(Math.sin(N(0)));
      case "cos": return VF(Math.cos(N(0)));
      case "tan": return VF(Math.tan(N(0)));
      case "log": return VF(Math.log(N(0)));
      case "log10": return VF(Math.log10(N(0)));
      case "exp": return VF(Math.exp(N(0)));
      case "floor": return VF(Math.floor(N(0)));
      case "ceil": return VF(Math.ceil(N(0)));
      case "round": return VI(Math.round(N(0)));
      case "random": return VI(A.length>1? N(0)+Math.floor(Math.random()*(N(1)-N(0))) : Math.floor(Math.random()*N(0)));
      case "randomSeed": case "esp_random": return VI(0);
      case "isnan": return VB(Number.isNaN(num(A[0])));
      case "isinf": return VB(!Number.isFinite(num(A[0]))&&!Number.isNaN(num(A[0])));
      case "String": return VS(A.length>1? fmtVal(A[0],N(1)) : fmtVal(A[0]));
      case "F": case "PSTR": return A[0]??VS("");
      case "pgm_read_byte": case "pgm_read_byte_near": case "pgm_read_word": return VI(num(A[0]));
      case "strlen": return VI(fmtVal(A[0]).length);
      case "ledcSetup": return VI(HW.ledcSetup(N(0),N(1),N(2)));
      case "ledcAttachPin": HW.ledcAttachPin(N(0),N(1)); return VOID;
      case "ledcAttach": return VI(HW.ledcAttach(N(0),N(1),N(2)));
      case "ledcDetachPin": HW.ledcDetachPin(N(0)); return VOID;
      case "ledcWrite": HW.ledcWrite(N(0),N(1)); return VOID;
      case "ledcWriteTone": return VI(HW.ledcWriteTone(N(0),N(1)));
      case "ledcWriteNote": return VI(HW.ledcWriteNote(N(0),N(1),N(2)));
      case "ledcRead": return VI(0);
      case "ledcReadFreq": return VI(HW.ledc[N(0)]?.freq||0);
      case "tone":{ HW.ledc[15]={pin:N(0),freq:N(1),res:8}; HW.ledcWriteTone(15,N(1)); return VOID; }
      case "noTone": HW.setTone(0); return VOID;
      case "attachInterrupt": case "detachInterrupt": case "noInterrupts":
      case "interrupts": case "randomSeed_": return VOID;
      case "digitalPinToInterrupt": return VI(N(0));
      case "Adafruit_SSD1306": return {t:"obj",v:{cls:"SSD1306"}};
      case "Adafruit_SHT31":  return {t:"obj",v:{cls:"SHT31"}};
      case "IPAddress": return {t:"obj",v:{cls:"IP",ip:A.length?A.map(a=>num(a)).join("."):"0.0.0.0"}};
    }
    this.err("'"+name+"' was not declared in this scope");
  }

  hostCall(objv,m,A,node){
    if(objv.t==="str") return this.stringCall(objv,m,A);
    if(objv.t!=="obj") this.err("request for member '"+m+"' in non-class type");
    const cls=objv.v.cls;
    const N=i=>num(A[i]);
    /* ---- Serial ---- */
    if(cls==="Serial"||cls==="Serial1"||cls==="Serial2"){
      switch(m){
        case "begin": HW.serialBaud=N(0)||115200; HW.serialOpen=true; UI.setBaud(HW.serialBaud); return VOID;
        case "end": HW.serialOpen=false; return VOID;
        case "print": SER.out(fmtVal(A[0],A.length>1?N(1):null)); return VI(1);
        case "println": SER.out(fmtVal(A[0]??VS(""),A.length>1?N(1):null)+"\n"); return VI(1);
        case "write": SER.out(A[0]?.t==="str"?A[0].v:String.fromCharCode(N(0))); return VI(1);
        case "printf": SER.out(this.sprintf(A)); return VI(1);
        case "flush": return VOID;
        case "available": return VI(HW.rx.length);
        case "read": return VI(HW.rx.length?HW.rx.shift().charCodeAt(0):-1);
        case "peek": return VI(HW.rx.length?HW.rx[0].charCodeAt(0):-1);
        case "readString": case "readStringUntil":{ const s=HW.rx.join(""); HW.rx=[]; return VS(s.replace(/\n$/,"")); }
        case "parseInt":{ const s=HW.rx.join(""); HW.rx=[]; return VI(parseInt(s)||0); }
        case "parseFloat":{ const s=HW.rx.join(""); HW.rx=[]; return VF(parseFloat(s)||0); }
        case "setTimeout": return VOID;
      }
    }
    /* ---- OLED ---- */
    if(cls==="SSD1306"){
      const C=i=>A.length>i?num(A[i]):1;
      switch(m){
        case "begin": OLED.init=true; OLED.buf.fill(0); OLED.show(); return VB(true);
        case "clearDisplay": OLED.buf.fill(0); return VOID;
        case "display": OLED.show(); return VOID;
        case "setTextSize": OLED.size=Math.max(1,N(0)); return VOID;
        case "setTextColor": OLED.color=N(0); OLED.bg=A.length>1?N(1):null; return VOID;
        case "setCursor": OLED.cx=N(0); OLED.cy=N(1); return VOID;
        case "getCursorX": return VI(OLED.cx);
        case "getCursorY": return VI(OLED.cy);
        case "setTextWrap": OLED.wrap=truthy(A[0]); return VOID;
        case "print": OLED.print(fmtVal(A[0],A.length>1?N(1):null)); return VI(1);
        case "println": OLED.print(fmtVal(A[0]??VS(""),A.length>1?N(1):null)+"\n"); return VI(1);
        case "write": OLED.print(A[0]?.t==="str"?A[0].v:String.fromCharCode(N(0))); return VI(1);
        case "printf": OLED.print(this.sprintf(A)); return VI(1);
        case "drawPixel": OLED.px(N(0),N(1),C(2)); return VOID;
        case "drawLine": OLED.line(N(0),N(1),N(2),N(3),C(4)); return VOID;
        case "drawFastHLine": OLED.hLine(N(0),N(1),N(2),C(3)); return VOID;
        case "drawFastVLine": OLED.vLine(N(0),N(1),N(2),C(3)); return VOID;
        case "drawRect": OLED.rect(N(0),N(1),N(2),N(3),C(4)); return VOID;
        case "fillRect": OLED.fillRect(N(0),N(1),N(2),N(3),C(4)); return VOID;
        case "drawRoundRect": OLED.roundRect(N(0),N(1),N(2),N(3),N(4),C(5)); return VOID;
        case "fillRoundRect": OLED.fillRoundRect(N(0),N(1),N(2),N(3),N(4),C(5)); return VOID;
        case "drawCircle": OLED.circle(N(0),N(1),N(2),C(3)); return VOID;
        case "fillCircle": OLED.fillCircle(N(0),N(1),N(2),C(3)); return VOID;
        case "drawTriangle": OLED.triangle(N(0),N(1),N(2),N(3),N(4),N(5),C(6)); return VOID;
        case "fillTriangle": OLED.fillTriangle(N(0),N(1),N(2),N(3),N(4),N(5),C(6)); return VOID;
        case "fillScreen": OLED.fillScreen(N(0)); return VOID;
        case "drawBitmap":{
          const bm=A[2];
          const bytes = bm&&bm.t==="arr" ? bm.v : [];
          OLED.bitmap(N(0),N(1),bytes,N(3),N(4),C(5)); return VOID;
        }
        case "invertDisplay": OLED.inv=truthy(A[0]); OLED.paint(); return VOID;
        case "width": return VI(128);
        case "height": return VI(64);
        case "dim": case "cp437": case "startscrollright": case "startscrollleft":
        case "startscrolldiagright": case "startscrolldiagleft": case "stopscroll":
        case "ssd1306_command": case "setRotation": case "setFont": return VOID;
      }
    }
    /* ---- SHT31 ---- */
    if(cls==="SHT31"){
      switch(m){
        case "begin": return VB(HW.shtOk());
        case "readTemperature": return VF(HW.shtOk()?HW.temp():NaN);
        case "readHumidity": return VF(HW.shtOk()?HW.hum():NaN);
        case "heater": case "reset": return VOID;
        case "isHeaterEnabled": return VB(false);
        case "readStatus": return VI(0);
      }
    }
    /* ---- WiFi ---- */
    if(cls==="WiFi"){
      switch(m){
        case "mode": HW.wifi.mode=N(0); return VB(true);
        case "begin": HW.wifiBegin(A[0]?fmtVal(A[0]):"",A[1]?fmtVal(A[1]):""); return VI(HW.wifiStatus());
        case "status": return VI(HW.wifiStatus());
        case "localIP": return {t:"obj",v:{cls:"IP",ip:HW.wifiIP()}};
        case "SSID": return VS(HW.wifi.ssid);
        case "RSSI": return VI(HW.wifiStatus()===3?-52-Math.floor(Math.random()*8):-100);
        case "macAddress": return VS("24:6F:28:AE:11:0C");
        case "disconnect": HW.wifi.beganAt=-1; HW.wifi.connected=false; HW.dirty=true; return VB(true);
        case "isConnected": return VB(HW.wifiStatus()===3);
        case "setSleep": case "setAutoReconnect": case "persistent": case "softAP": return VB(true);
        case "waitForConnectResult": return VI(HW.wifiStatus());
        case "channel": return VI(6);
      }
    }
    if(cls==="Wire"){ if(m==="begin"||m==="setClock"||m==="end") return VOID; }
    if(cls==="SPI"){ if(m==="begin"||m==="end") return VOID; }
    if(cls==="ESP"){
      if(m==="restart"){ throw {__restart:true}; }
      if(m==="getFreeHeap") return VI(285000);
      if(m==="getChipModel") return VS("ESP32-D0WDQ6");
    }
    if(cls==="IP"){ if(m==="toString") return VS(objv.v.ip); }
    this.err("'class "+cls+"' has no member named '"+m+"'");
  }
  stringCall(s,m,A){
    const v=s.v, N=i=>num(A[i]);
    switch(m){
      case "length": return VI(v.length);
      case "toInt": return VI(parseInt(v)||0);
      case "toFloat": return VF(parseFloat(v)||0);
      case "c_str": case "toString": return VS(v);
      case "equals": return VB(v===fmtVal(A[0]));
      case "equalsIgnoreCase": return VB(v.toLowerCase()===fmtVal(A[0]).toLowerCase());
      case "indexOf": return VI(v.indexOf(fmtVal(A[0])));
      case "substring": return VS(A.length>1?v.substring(N(0),N(1)):v.substring(N(0)));
      case "charAt": return VC(v.charCodeAt(N(0))||0);
      case "toUpperCase": return VS(v.toUpperCase());
      case "toLowerCase": return VS(v.toLowerCase());
      case "trim": return VS(v.trim());
      case "startsWith": return VB(v.startsWith(fmtVal(A[0])));
      case "endsWith": return VB(v.endsWith(fmtVal(A[0])));
      case "concat": return VS(v+fmtVal(A[0]));
      case "replace": return VS(v.split(fmtVal(A[0])).join(fmtVal(A[1])));
    }
    this.err("'class String' has no member named '"+m+"'");
  }
  sprintf(A){
    let f=fmtVal(A[0]), i=1;
    return f.replace(/%[-+ 0#]*\d*(?:\.\d+)?[dioufFeEgGxXscb%]/g,(sp)=>{
      if(sp==="%%") return "%";
      const a=A[i++];
      if(/[dioub]$/.test(sp)) return String(Math.trunc(num(a)));
      if(/[xX]$/.test(sp)) return (num(a)>>>0).toString(16);
      if(/[fFeEgG]$/.test(sp)){
        const mm=sp.match(/\.(\d+)/); return num(a).toFixed(mm?+mm[1]:6);
      }
      if(/s$/.test(sp)) return fmtVal(a);
      if(/c$/.test(sp)) return String.fromCharCode(num(a));
      return sp;
    });
  }
}

/* =========================================================================
   SEMANTIC CHECK (compile-time "was not declared in this scope")
   ========================================================================= */
function checkProgram(ast,includes){
  const errs=[];
  const globals=new Set(["setup","loop"]);
  for(const d of ast){
    if(d.k==="func"||d.k==="proto") globals.add(d.name);
    if(d.k==="var") d.items.forEach(i=>globals.add(i.name));
  }
  const known=n=> globals.has(n)||BUILTIN_FUNCS.has(n)||BUILTIN_OBJS.has(n)||
                  Object.prototype.hasOwnProperty.call(CONSTS,n);

  // library checks
  const needs=(cls,hdr,msg)=>{
    const used=ast.some(d=>(d.k==="var"&&d.type.raw.includes(cls)));
    if(used&&!includes.some(h=>h.toLowerCase().includes(hdr)))
      errs.push({line:ast.find(d=>d.k==="var"&&d.type.raw.includes(cls)).line,
                 msg:"'"+cls+"' does not name a type"});
  };
  needs("Adafruit_SSD1306","adafruit_ssd1306");
  needs("Adafruit_SHT31","adafruit_sht31");

  const scopes=[];
  const declared=n=>{ for(let i=scopes.length-1;i>=0;i--) if(scopes[i].has(n)) return true; return known(n); };

  function walkE(e,fname){
    if(!e||errs.length>3) return;
    switch(e.k){
      case "id":
        if(!declared(e.v)) errs.push({line:e.line,msg:"'"+e.v+"' was not declared in this scope",fn:fname});
        break;
      case "bin": walkE(e.l,fname); walkE(e.r,fname); break;
      case "assign": walkE(e.l,fname); walkE(e.r,fname); break;
      case "un": case "pre": case "post": case "cast": walkE(e.e,fname); break;
      case "cond": walkE(e.c,fname); walkE(e.a,fname); walkE(e.b,fname); break;
      case "comma": walkE(e.l,fname); walkE(e.r,fname); break;
      case "index": walkE(e.o,fname); walkE(e.i,fname); break;
      case "member": walkE(e.o,fname); break;
      case "initlist": e.el.forEach(x=>walkE(x,fname)); break;
      case "call":
        if(e.callee.k==="id"){
          if(!declared(e.callee.v))
            errs.push({line:e.line,msg:"'"+e.callee.v+"' was not declared in this scope",fn:fname});
        } else walkE(e.callee,fname);
        e.args.forEach(a=>walkE(a,fname));
        break;
    }
  }
  function walkS(s,fname){
    if(!s||errs.length>3) return;
    switch(s.k){
      case "block": scopes.push(new Set()); s.body.forEach(x=>walkS(x,fname)); scopes.pop(); break;
      case "var":
        s.items.forEach(i=>{ if(i.init) walkE(i.init,fname); if(i.ctor) i.ctor.forEach(a=>walkE(a,fname)); });
        s.items.forEach(i=>scopes[scopes.length-1].add(i.name));
        break;
      case "expr": walkE(s.e,fname); break;
      case "if": walkE(s.c,fname); walkS(s.th,fname); walkS(s.el,fname); break;
      case "while": walkE(s.c,fname); walkS(s.b,fname); break;
      case "do": walkS(s.b,fname); walkE(s.c,fname); break;
      case "for":
        scopes.push(new Set());
        if(s.init) walkS(s.init,fname);
        walkE(s.cond,fname); walkE(s.step,fname); walkS(s.b,fname);
        scopes.pop(); break;
      case "switch":
        walkE(s.d,fname); scopes.push(new Set());
        s.cases.forEach(c=>{ walkE(c.test,fname); c.body.forEach(x=>walkS(x,fname)); });
        scopes.pop(); break;
      case "return": walkE(s.e,fname); break;
    }
  }
  for(const d of ast){
    if(d.k!=="func") continue;
    scopes.length=0;
    scopes.push(new Set(d.params.map(p=>p.name).filter(Boolean)));
    walkS(d.body,(d.ret.raw||"void")+" "+d.name+"()");
  }
  if(!ast.some(d=>d.k==="func"&&d.name==="setup")) errs.push({line:1,msg:"undefined reference to `setup()'"});
  if(!ast.some(d=>d.k==="func"&&d.name==="loop"))  errs.push({line:1,msg:"undefined reference to `loop()'"});
  return errs;
}


/* =========================================================================
   UI + SCHEDULER
   ========================================================================= */
const UI = {
  el:{
    code:{ get value(){ return HOST.source(); } },
    tempR:ro(()=>INPUTS.temp), humR:ro(()=>INPUTS.hum), adcR:ro(()=>INPUTS.adc),
    shtOn:ro(()=>INPUTS.shtOn), apSsid:ro(()=>INPUTS.apSsid), apPass:ro(()=>INPUTS.apPass),
    apDelay:ro(()=>INPUTS.apDelay), apOn:ro(()=>INPUTS.apOn),
    tsChk:ro(()=>INPUTS.timestamp), asChk:ro(()=>INPUTS.autoscroll),
    btnRun:{disabled:false}, btnStop:{disabled:true}
  },
  logs:[], serLines:[], serPartial:"", rev:0,
  log(t,cls){
    this.logs.push({text:t,cls:cls||""});
    if(this.logs.length>400) this.logs.splice(0,this.logs.length-400);
    this.rev++;
  },
  clearLog(){ this.logs=[]; this.rev++; },
  setBadge(t,cls){ HOST.badge(t,cls||""); },
  setBaud(b){ HOST.baud(b); },
  stamp(){
    const d=new Date(), p=(n,l=2)=>String(n).padStart(l,"0");
    return p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds())+"."+p(d.getMilliseconds(),3)+" -> ";
  },
  serialLine(t){
    this.serLines.push((INPUTS.timestamp?this.stamp():"")+t);
    if(this.serLines.length>500) this.serLines.splice(0,this.serLines.length-500);
    this.serPartial=""; this.rev++;
  },
  serialPartial(t){ this.serPartial=t; this.rev++; },
  flushSerial(){},
  clearSerial(){ this.serLines=[]; this.serPartial=""; this.rev++; },
  serialText(){
    return this.serLines.join("\n")+(this.serPartial?"\n"+(INPUTS.timestamp?this.stamp():"")+this.serPartial:"");
  }
};



/* ---------------- editor ---------------- */
const KW1=new Set(["int","float","double","char","bool","boolean","void","long","short","byte","unsigned",
  "signed","const","static","String","uint8_t","uint16_t","uint32_t","size_t","word","volatile","struct","PROGMEM"]);
const KW3=new Set(["if","else","for","while","do","switch","case","default","break","continue","return",
  "true","false","and","or","not","new","delete","sizeof","class","public","private"]);
const KW2=new Set([...BUILTIN_FUNCS,"Serial","Wire","WiFi","SPI","display","sht31","setup","loop",
  "HIGH","LOW","INPUT","OUTPUT","INPUT_PULLUP","WHITE","BLACK","SSD1306_SWITCHCAPVCC","WL_CONNECTED"]);

function escHtml(s){ return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function highlight(src){
  const re=/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(^[ \t]*#[^\n]*)|(\b\d[\w.]*)|(\b[A-Za-z_]\w*\b)/gm;
  let out="",last=0,m;
  while((m=re.exec(src))){
    out+=escHtml(src.slice(last,m.index));
    const s=m[0];
    if(m[1]) out+='<span class="cmt">'+escHtml(s)+"</span>";
    else if(m[2]||m[3]) out+='<span class="str">'+escHtml(s)+"</span>";
    else if(m[4]) out+='<span class="pre">'+escHtml(s)+"</span>";
    else if(m[5]) out+='<span class="num">'+escHtml(s)+"</span>";
    else{
      if(KW1.has(s)) out+='<span class="k1">'+s+"</span>";
      else if(KW3.has(s)) out+='<span class="k3">'+s+"</span>";
      else if(KW2.has(s)||Object.prototype.hasOwnProperty.call(CONSTS,s)) out+='<span class="k2">'+s+"</span>";
      else out+=escHtml(s);
    }
    last=m.index+s.length;
  }
  out+=escHtml(src.slice(last));
  return out;
}
let errLine=0;
function refreshEditor(){ HOST.errLine(errLine); }

/* ---------------- compile & run ---------------- */
const RUN={ interp:null, gen:null, timer:null, running:false, srcLines:[] };

function stopRun(silent){
  RUN.running=false;
  if(RUN.timer){ clearTimeout(RUN.timer); RUN.timer=null; }
  HW.setTone(0);
  UI.el.btnStop.disabled=true; UI.el.btnRun.disabled=false;
  if(!silent){ UI.setBadge("stopped"); UI.log("โปรแกรมหยุดทำงาน (Stop)","warn"); }
}

function compileAndRun(){
  stopRun(true);
  UI.clearLog(); UI.clearSerial(); SER.clear();
  errLine=0;
  const src=UI.el.code.value;
  RUN.srcLines=src.split("\n");
  UI.log("กำลังคอมไพล์ sketch สำหรับบอร์ด \"ESP32 Dev Module\"...","dim");
  let ast,includes;
  try{
    const pp=preprocess(src);
    includes=pp.includes;
    const toks=expandMacros(lex(pp.code),pp.macros);
    ast=new Parser(toks).parseProgram();
  }catch(e){
    if(e instanceof CompileError) return failCompile(e.line,e.message);
    return failCompile(0,e.message||String(e));
  }
  const errs=checkProgram(ast,includes||[]);
  if(errs.length){
    const e=errs[0];
    if(e.fn) UI.log(SKETCH+": In function '"+e.fn+"':","");
    return failCompile(e.line,e.msg);
  }
  // fake compile stats
  const bytes=246000+src.length*7+Math.floor(Math.random()*400);
  const glob=14200+Math.floor(src.length*1.3);
  UI.log("Sketch uses "+bytes+" bytes ("+(bytes/1310720*100).toFixed(0)+"%) of program storage space. Maximum is 1310720 bytes.");
  UI.log("Global variables use "+glob+" bytes ("+(glob/327680*100).toFixed(0)+"%) of dynamic memory, leaving "+(327680-glob)+" bytes for local variables. Maximum is 327680 bytes.");
  UI.log("esptool.py v4.5.1");
  UI.log("Connecting........ Chip is ESP32-D0WDQ6 (revision v1.0)");
  UI.log("Writing at 0x00010000... (100 %)  Hash of data verified.");
  UI.log("Hard resetting via RTS pin...","ok");
  UI.log("--- โปรแกรมเริ่มทำงานบนบอร์ดจำลอง ---","ok");
  refreshEditor();
  startProgram(ast,includes||[]);
}
function failCompile(line,msg){
  errLine=line||0;
  const src=RUN.srcLines[line-1];
  if(line&&src!==undefined){
    UI.log(SKETCH+":"+line+":"+(src.search(/\S/)+1)+": error: "+msg,"err");
    UI.log("  "+String(line).padStart(3," ")+" | "+src,"dim");
    UI.log("      | "+" ".repeat(Math.max(0,src.search(/\S/)))+"^","dim");
  } else {
    UI.log(SKETCH+": error: "+msg,"err");
  }
  UI.log("exit status 1","err");
  UI.log("Compilation error: "+msg,"err");
  UI.setBadge("compile error","err");
  refreshEditor();
  return false;
}

function startProgram(ast,includes){
  HW.reset(); OLED.reset(); SER.clear(); UI.clearSerial();
  RUN.interp=new Interp(ast,includes);
  RUN.gen=(function*(itp){
    yield* itp.initGlobals();
    if(itp.funcs.has("setup")) yield* itp.invoke(itp.funcs.get("setup"),[]);
    if(itp.funcs.has("loop")){
      for(;;){ yield* itp.invoke(itp.funcs.get("loop"),[]); yield "tick"; }
    }
  })(RUN.interp);
  RUN.running=true;
  UI.el.btnStop.disabled=false; UI.el.btnRun.disabled=false;
  UI.setBadge("running","run");
  step();
}
function step(){
  if(!RUN.running) return;
  const budget=performance.now()+8;
  try{
    for(;;){
      const r=RUN.gen.next();
      if(r.done){ UI.log("--- โปรแกรมจบการทำงาน ---","dim"); stopRun(true); UI.setBadge("finished"); return; }
      const v=r.value;
      if(v&&typeof v==="object"&&v.sleep!=null){
        const ms=Math.max(0,v.sleep/HW.speed);
        RUN.timer=setTimeout(step,ms);
        return;
      }
      if(performance.now()>budget){ RUN.timer=setTimeout(step,0); return; }
    }
  }catch(e){
    if(e&&e.__restart){ UI.log("ets Jun  8 2016 rst:0x3 (SW_RESET)","warn"); restartSketch(); return; }
    HW.setTone(0);
    const ln=(e&&e.line)||RUN.interp.line||0;
    const src=RUN.srcLines[ln-1];
    UI.log(SKETCH+":"+ln+": runtime error: "+(e.message||e),"err");
    if(src!==undefined) UI.log("  "+ln+" | "+src,"dim");
    errLine=ln; refreshEditor();
    UI.setBadge("runtime error","err");
    stopRun(true);
  }
}
function restartSketch(){
  if(!RUN.interp) return;
  const ast=RUN.interp.ast, inc=RUN.interp.includes;
  stopRun(true);
  UI.clearSerial(); SER.clear();
  UI.log("--- RESET : บอร์ดเริ่มทำงานใหม่ ---","ok");
  startProgram(ast,inc);
}

/* ---------------- exported API ---------------- */
function lvl(p){
  if(HW.pwm[p]!=null) return (100-Math.round(HW.pwm[p]/255*100))+"%";
  return (HW.pinVal[p]??1)===0?"ON":"off";
}
function snapshot(){
  const r=HW.chanLevel(PIN.R), g=HW.chanLevel(PIN.G), b=HW.chanLevel(PIN.B);
  const R=Math.round(r*255),G=Math.round(g*255),B=Math.round(b*255);
  const lit=(r+g+b)>0.02;
  const r1=(HW.pinVal[PIN.RELAY1]??1)===0, r2=(HW.pinVal[PIN.RELAY2]??1)===0;
  const st=HW.wifiStatus();
  const wifiTxt=["IDLE","NO_SSID","SCAN","CONNECTED","FAILED","LOST","DISCONNECTED"][st]||"-";
  return {
    rgbCss:"rgb("+R+","+G+","+B+")",
    rgbGlow: lit? "0 0 26px 12px rgba("+R+","+G+","+B+",.5)" : "none",
    relay1:r1, relay2:r2, tone:HW.toneFreq,
    btnA:HW.btnA, btnB:HW.btnB,
    wifi:wifiTxt, wifiOk:st===3, running:RUN.running,
    millis: RUN.running?HW.millis():0,
    adc: HW.analogRead(36),
    chips:[
      {k:"D25 R", v:lvl(PIN.R), hi:r>0},
      {k:"D26 G", v:lvl(PIN.G), hi:g>0},
      {k:"D27 B", v:lvl(PIN.B), hi:b>0},
      {k:"D0 A", v:HW.btnA?"LOW":"HIGH", hi:HW.btnA},
      {k:"D4 B", v:HW.btnB?"LOW":"HIGH", hi:HW.btnB},
      {k:"D32 K1", v:r1?"ON":"OFF", hi:r1},
      {k:"D14 K2", v:r2?"ON":"OFF", hi:r2},
      {k:"D33 BUZ", v:HW.toneFreq>0?HW.toneFreq+"Hz":"off", hi:HW.toneFreq>0},
      {k:"A36 VR", v:String(HW.analogRead(36)), hi:false},
      {k:"WiFi", v:wifiTxt, hi:st===3},
      {k:"millis", v:String(RUN.running?HW.millis():0), hi:false}
    ]
  };
}
window.SPUSim = {
  EXAMPLES, PIN, HW, OLED, Audio_, UI, RUN, HOST, INPUTS,
  highlight, snapshot, lvl,
  run(){ Audio_.init(); compileAndRun(); },
  stop(){ stopRun(false); },
  reset(){ if(RUN.interp) restartSketch(); else compileAndRun(); },
  setBtn(which,down){ if(which==="A") HW.btnA=down; else HW.btnB=down; HW.dirty=true; },
  sendSerial(v){ if(!v) return; for(const ch of v+"\n") HW.rx.push(ch); UI.serialLine("[TX] "+v); },
  paintOLED(){ OLED.paint(); },
  rev(){ return UI.rev; },
  logs(){ return UI.logs; },
  serialText(){ return UI.serialText(); },
  unlockAudio(){ Audio_.init(); }
};

})(); }
