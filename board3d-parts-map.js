/* board3d-parts-map.js
 * ตาราง lookup ระหว่างอาเรย์ PARTS (index.html, 13 รายการ) กับชื่อ Object 3D
 * ลำดับ "ต้องตรงกับลำดับ PARTS ใน index.html เป๊ะๆ" (index ตรงกัน ไม่ใช่จับคู่ด้วยชื่อ)
 * ชื่อ 6 รายการแรก (RGB_LED, RELAY1, RELAY2, BUZZER, POT_VR, BTN_A/BTN_B, OLED_Screen,
 * SHT31_Sensor, ESP32_Board) ตรงกับตาราง Section 4 ของ 3D-SIMULATOR-PLAN.md
 * ส่วน RST_Button / GPIO_Header / USB_Port เป็นชื่อเสริมที่ตั้งขึ้นด้วยแนวทางเดียวกัน
 * เพื่อให้ครอบคลุมทุก entry ของ PARTS (ตาราง Section 4 เดิมไม่ได้ระบุ 3 รายการนี้ไว้)
 *
 * ใช้ชื่อเดียวกันนี้ทั้งโมเดล primitive (Phase A) และโมเดล Blender/.glb (Phase B)
 * เพื่อให้ swap โมเดลได้โดยไม่ต้องแก้โค้ด lookup
 */
export const PART_NAMES_3D = [
  "ESP32_Board",   // 0  ESP32 Module
  "SHT31_Sensor",  // 1  SHT31
  "RST_Button",    // 2  Reset (RST)
  "RGB_LED",       // 3  RGB LED (GPIO 25/26/27)
  "GPIO_Header",   // 4  Pin Header
  "OLED_Screen",   // 5  OLED Display
  "BTN_A",         // 6  Button A (GPIO 0)
  "BTN_B",         // 7  Button B (GPIO 4)
  "RELAY1",        // 8  Relay 1 (GPIO 32)
  "RELAY2",        // 9  Relay 2 (GPIO 14)
  "POT_VR",        // 10 VR 10K (A36)
  "BUZZER",        // 11 Buzzer (GPIO 33)
  "USB_Port"       // 12 USB Port
];
