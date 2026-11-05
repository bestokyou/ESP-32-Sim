# ESP32 Board Simulator — ตัวจำลองบอร์ด ESP32

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?logo=github)](https://bestokyou.github.io/ESP-32-Sim/)

**[ลองใช้งานจริง →](https://bestokyou.github.io/ESP-32-Sim/)**

ตัวจำลองบอร์ด ESP32 ที่ทำงานบนเว็บเบราว์เซอร์ เขียนโค้ดแบบ Arduino (`.ino`)
ในตัวแก้ไขโค้ดบนหน้าเว็บ แล้วกดรันบนบอร์ดจำลองได้ทันที
ไม่ต้องมีบอร์ดจริง และไม่ต้องติดตั้ง Arduino IDE

## ความสามารถ

- ตัวแปลภาษา C/C++ แบบ Arduino ที่เขียนขึ้นเอง (lexer / parser / interpreter)
  แสดงผลการคอมไพล์และข้อความ error เลียนแบบ `arduino-cli`
- แสดงบอร์ดได้ทั้งแบบ 2D (SVG) และ 3D (Three.js) ที่ทำงานตรงกับโค้ดที่รันอยู่
- Serial Monitor (ปรับ baud rate ได้, แสดงเวลา, เลื่อนอัตโนมัติ, ส่งข้อความ)
- แท็บ WiFi Router และอุปกรณ์บนบอร์ด: เซนเซอร์ SHT31, ตัวต้านทานปรับค่า,
  ปุ่มกด, รีเลย์, บัซเซอร์, ไฟ RGB และจอ OLED
- โค้ดตัวอย่างพร้อมใช้, เปิด/บันทึกไฟล์ `.ino`, ธีมสว่าง/มืด
  และจำสถานะล่าสุดไว้ใน `localStorage`
- ลิงก์ตรงไปยังแต่ละตัวอย่าง เหมาะสำหรับแจกนักเรียน
- โหลดมุมมอง 3D เฉพาะเมื่อกดปุ่ม **3D View** ทำให้เปิดหน้าเว็บได้เร็วขึ้น

## ลิงก์ตัวอย่าง

เติม `#ชื่อตัวอย่าง` ต่อท้าย URL เพื่อเปิดตัวอย่างนั้นทันที

| ลิงก์ | ตัวอย่าง |
|---|---|
| [`#blank`](https://bestokyou.github.io/ESP-32-Sim/#blank) | เริ่มเขียนใหม่ |
| [`#selftest`](https://bestokyou.github.io/ESP-32-Sim/#selftest) | ทดสอบอุปกรณ์บนบอร์ด |
| [`#ex1`](https://bestokyou.github.io/ESP-32-Sim/#ex1) | ข้อ 1 · ปุ่ม A/B/A+B + RGB + OLED |
| [`#ex2`](https://bestokyou.github.io/ESP-32-Sim/#ex2) | ข้อ 2 · Toggle ปุ่ม + รีเลย์ + OLED |
| [`#ex3`](https://bestokyou.github.io/ESP-32-Sim/#ex3) | ข้อ 3 · SHT31 + OLED + RGB + Buzzer |
| [`#ex4`](https://bestokyou.github.io/ESP-32-Sim/#ex4) | ข้อ 4 · SHT31 + OLED + Relay + Buzzer |
| [`#ex5`](https://bestokyou.github.io/ESP-32-Sim/#ex5) | ข้อ 5 · WiFi + RGB + Buzzer + IP บน OLED |
| [`#ex6`](https://bestokyou.github.io/ESP-32-Sim/#ex6) | ข้อ 6 · กราฟิก WiFi Connect/Disconnect |

## รันบนเครื่องตัวเอง

ไม่ต้อง build เพราะเป็นไฟล์ HTML/JS ธรรมดา ใช้ static file server ตัวไหนก็ได้ เช่น

```bash
npx serve .
```

แล้วเปิด URL ที่แสดงขึ้นมาในเบราว์เซอร์

## รันด้วย Docker

```bash
docker compose up --build
```

แล้วเปิด [http://localhost:8080](http://localhost:8080)

## โครงสร้างโปรเจกต์

- [index.html](index.html) — หน้าเว็บ, สไตล์ และการเชื่อมส่วนต่างๆ ของแอป
- [sim-engine.js](sim-engine.js) — ตัวคอมไพล์/แปลภาษา sketch และแบบจำลองฮาร์ดแวร์
- [board3d.js](board3d.js) — มุมมองบอร์ด 3D ด้วย Three.js
- [board3d-parts-map.js](board3d-parts-map.js) — จับคู่ชื่อชิ้นส่วนในโมเดล 3D
  กับอุปกรณ์บนบอร์ดจำลอง
- [assets/](assets) — texture ของบอร์ด (`pcb-top.png`), โมเดล 3D ที่เว็บใช้ (`board.glb`)
  และไฟล์ Blender ต้นฉบับ (`board-source.blend`)
- [3D-SIMULATOR-PLAN.md](3D-SIMULATOR-PLAN.md) — บันทึกการออกแบบมุมมอง 3D
  และแผนการพัฒนาเป็นระยะ
