# Technical Project Plan: Interactive 3D ESP32 Simulator (ชั้น 3D เสริมบนระบบจำลองที่มีอยู่)

## Context (บริบทและที่มา)

โปรเจกต์ "ESP32 simulator" มีระบบจำลองบอร์ด ESP32 แบบ 2D ที่**ใช้งานได้จริงอยู่แล้ว**:

- `index.html` (~1,130 บรรทัด): เรนเดอร์บอร์ดแบบ 2D ด้วย inline SVG (โครง PCB) + `<div>` จัดตำแหน่งแบบ absolute สำหรับแต่ละอุปกรณ์ (RGB LED, รีเลย์ 2 ตัว, บัซเซอร์, เซนเซอร์ SHT31, โพเทนชิโอมิเตอร์, ปุ่มกด 2 ปุ่ม) และ `<canvas id="oled">` จริงสำหรับจอ OLED การคลิกขา GPIO/ชิ้นส่วนใช้อาเรย์ `PARTS` (`{x,y,side,name,pin,desc}`) เปิด popover `#partInfo` ผ่าน `showPart(i)` หน้าเว็บทั้งหมดอัปเดตด้วยการ **poll** `window.SPUSim.snapshot()` ทุกเฟรม (`requestAnimationFrame`) — ไม่มี event/pub-sub ใดๆ ในระบบ
- `sim-engine.js` (1,740 บรรทัด, global `window.SPUSim`): เป็น**อินเทอร์พรีเตอร์ภาษา Arduino C++ (subset) ของจริง** มี preprocessor/lexer/parser/tree-walking interpreter ของตัวเอง สถานะฮาร์ดแวร์อยู่ใน object เดียวชื่อ `HW` พร้อมแผนที่ขา `PIN = {R:25, G:26, B:27, BTN_A:0, BTN_B:4, RELAY1:32, RELAY2:14, BUZZER:33, VR:36}` รองรับ OLED SSD1306 emulator เต็มรูปแบบ, บัซเซอร์ผ่าน Web Audio, WiFi state machine จำลอง ระบบรันแบบ generator + `setTimeout` cooperative loop ไม่มี pub/sub ให้ subscribe (มีแฟล็ก `HW.dirty` แต่เขียนแล้วไม่มีใครอ่าน)
- `support.js` เป็นไฟล์ React/JSX runtime ที่หลงเหลืออยู่ **ไม่เกี่ยวข้องกับระบบนี้เลย** และ `index.html` ไม่ได้โหลดไฟล์นี้ — ไม่ต้องนำมาพิจารณาในแผนนี้
- Deploy ผ่าน nginx (Docker) เสิร์ฟไฟล์ static ตรงๆ ไม่มี build step/bundler/package.json ใดๆ ในโปรเจกต์

เอกสาร "แบบเสนอโครงงาน" (.docx) ที่มีอยู่ เป็นข้อเสนอโครงการวิชาเรียน **4 สัปดาห์ งบประมาณ 0 บาท** ซึ่งครอบคลุมเฉพาะระบบ 2D ที่มีอยู่แล้วเท่านั้น

**การตัดสินใจที่ยืนยันกับผู้ใช้แล้ว** (ใช้เป็นสมมติฐานหลักของแผนนี้):
1. งาน 3D นี้เป็น**โครงการต่อยอดแยกออกมา** ไม่ผูกกับกำหนดเวลา 4 สัปดาห์เดิม มีเวลาวางแผนเฟสได้ตามจริง
2. โมเดลอุปกรณ์/วงจร: **คงชุดอุปกรณ์แบบตายตัว (fixed)** ตามที่มีอยู่ (RGB LED, รีเลย์ 2, บัซเซอร์, SHT31, โพเทนชิโอมิเตอร์, OLED, ปุ่ม 2 ปุ่ม) — **ยังไม่สร้าง** ระบบ drag-and-drop circuit editor แบบทั่วไปที่ให้ผู้ใช้ลากอุปกรณ์ภายนอกมาต่อเองในระยะ MVP (ผลักไปเป็น Phase ในอนาคตที่แยกชัดเจน)
3. กลยุทธ์โมเดล 3D: **เริ่มจาก primitive geometry อย่างง่าย** (กล่อง/ทรงกระบอก/แผ่นระนาบ) ให้ใช้งานโต้ตอบได้ก่อน แล้วค่อยอัปเกรดเป็นโมเดล Blender ที่สมจริงในเฟสถัดไป โดยออกแบบ naming convention ให้ swap ไฟล์ GLB เข้ามาแทนได้โดยไม่ต้องเขียนโค้ดใหม่

---

## 1. Project Overview

**ภาพรวม**: เพิ่มชั้นการแสดงผล 3D เชิงโต้ตอบ (ใช้ Three.js) ครอบ/สลับกับหน้าบอร์ด 2D ที่มีอยู่ โดย**ไม่แก้ไข `sim-engine.js`** (หรือแก้ให้น้อยที่สุด) — ให้ `sim-engine.js` เป็น single source of truth ของสถานะจำลองเหมือนเดิม ชั้น 3D เป็นเพียง "ผู้บริโภค" (consumer) ข้อมูลรายที่สองที่อ่านจาก `window.SPUSim` เท่านั้น

**ความเป็นไปได้**: สูง — เพราะ (ก) ระบบจำลอง (sim-engine.js) แยกเป็นเลเยอร์ตรรกะล้วนๆ ไม่ผูกกับการเรนเดอร์ 2D อยู่แล้ว (เข้าถึงผ่าน `snapshot()`) (ข) อาเรย์ `PARTS` ที่มีอยู่ให้พิกัด/ชื่อ/คำอธิบายของแต่ละชิ้นส่วนพร้อมใช้เป็นฐานสำหรับแมปตำแหน่งวัตถุ 3D (ค) โปรเจกต์ไม่มี build tooling ผูกมัด ทำให้เพิ่ม Three.js ผ่าน ES module + import map ได้โดยไม่กระทบโครงสร้างเดิม

**รุ่น ESP32 ที่ใช้อ้างอิง**: บอร์ดจำลองปัจจุบันระบุตัวเองเป็น "ESP32 Dev Module / SPU IoT Board" — **ไม่ต้องเปลี่ยนรุ่นอ้างอิง** เพียงนำเลย์เอาต์ขาที่มีอยู่ (`PIN` constants) มาสร้างโมเดล 3D ให้ตรงกัน ไม่ต้องรองรับ ESP32 รุ่นอื่นในเฟสนี้

---

## 2. Recommended Technology Stack

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| 3D engine | **Three.js** (pin เวอร์ชันนิ่ง เช่น `0.160.0`) ผ่าน CDN ESM + `<script type="importmap">` | ไม่ต้องมี bundler/Node.js/package.json ตรงกับสถาปัตยกรรม static-site ปัจจุบัน 100% |
| Loader (เฟส B) | `GLTFLoader` (จาก `three/addons/loaders/`) โหลดไฟล์ `.glb` | ไฟล์เดียว บีบอัด binary เหมาะกับ static host ไม่มี CDN เสริม |
| Controls | `OrbitControls` (จาก `three/addons/controls/`) | รองรับ touch ของแท็บเล็ตในตัว ไม่ต้องเขียนเพิ่ม |
| Model format | `.glb` (binary glTF) | Blender มี exporter ในตัว (`io_scene_gltf2`) แปลงแกน Z-up → Y-up ให้อัตโนมัติ |
| Fallback (ไม่มีอินเทอร์เน็ตตอน demo) | vendor สำเนา local ของ `three.module.js` + `OrbitControls.js` + `GLTFLoader.js` ใน `vendor/three/` | สำรองไว้กรณีห้องสอบ/ห้องสาธิตไม่มีเน็ต |
| Build tooling | **ไม่ใช้** bundler (Vite/webpack ฯลฯ) | โปรเจกต์ไม่มีโครงสร้าง build อยู่แล้ว การเพิ่ม Node toolchain จะเปลี่ยนวิธี deploy ของ Docker/nginx โดยไม่จำเป็น |

---

## 3. System Architecture

### โมดูลใหม่: `board3d.js` (ES module)

เพิ่ม `<canvas id="board3d-canvas">` เป็นพี่น้องกับ `#board` เดิมภายใน `#stage` พร้อมปุ่มสลับ "3D View" — ใช้วิธี **toggle (ซ่อน/แสดง) ไม่ใช่วางซ้อนกัน** ในเฟส MVP เพื่อเลี่ยงปัญหา z-index/CSS-transform ของ layout เดิม และให้มุมมอง 2D ที่ทำงานดีอยู่แล้วยังใช้ได้เป็น fallback เสมอ

```html
<div id="stage">
  <div id="board">...2D เดิม...</div>
  <canvas id="board3d-canvas" style="display:none;"></canvas>
</div>
<button id="toggle3d">3D View</button>
```

`board3d.js` export ฟังก์ชัน `initBoard3D(canvas) -> { show(), hide(), update(snapshot), dispose() }` ถูกเรียกจาก inline script เดิมผ่าน `<script type="module">`

### การรับสถานะ: Polling (ไม่ทำ pub/sub ใหม่)

**ใช้วิธี poll ของเดิมต่อ** — ขยาย `tick()` ที่มีอยู่ใน `index.html` ให้ส่ง `snapshot()` เดียวกันต่อให้ `board3d.update(S)` ด้วย (เรียก `snapshot()` ครั้งเดียวต่อเฟรม ใช้ร่วมกันทั้ง 2D/3D):

```js
function tick() {
  const S = SPUSim.snapshot();
  renderPins(S);
  if (window.__board3d && board3dVisible) window.__board3d.update(S);
  requestAnimationFrame(tick);
}
```

**เหตุผลที่ไม่แก้ `HW.dirty` ให้เป็น event ของจริง**: `HW.dirty` ปัจจุบันเขียนแล้วไม่มีใครอ่าน การทำให้เป็น pub/sub จริงต้องแก้ตรรกะภายใน `sim-engine.js` ซึ่งขัดกับเงื่อนไข "ไม่แก้อินเทอร์พรีเตอร์" และ polling แบบ rAF ที่มีอยู่ก็พิสูจน์แล้วว่าเพียงพอต่อการรับรู้ด้วยสายตามนุษย์ ถ้าในอนาคตต้องอัปเกรดจริงๆ ให้ monkey-patch `HW.digitalWrite`/`HW.analogWrite` **จากภายนอก** (ในไฟล์ `board3d.js`) ไม่แก้ในไฟล์ `sim-engine.js`

---

## 4. Blender Modeling Workflow (สำหรับ Phase B ในอนาคต — เตรียมไว้ล่วงหน้า)

แม้ MVP จะใช้ primitive geometry แต่ต้องกำหนด **Naming Convention เดียวที่ใช้ร่วมกันได้ทั้งสองเฟส** ตั้งแต่วันแรก เพื่อให้ swap เป็นโมเดล Blender ทีหลังโดยไม่ต้องเขียนโค้ดใหม่:

| ชิ้นส่วน | อ้างอิงจาก `PARTS`/`PIN` เดิม | ชื่อ Object 3D (ใช้ทั้ง primitive และ Blender) |
|---|---|---|
| ตัวบอร์ด ESP32 | — | `ESP32_Board` |
| RGB LED | `PIN.R=25,G=26,B=27` | `RGB_LED` |
| รีเลย์ 1 | `PIN.RELAY1=32` | `RELAY1` |
| รีเลย์ 2 | `PIN.RELAY2=14` | `RELAY2` |
| บัซเซอร์ | `PIN.BUZZER=33` | `BUZZER` |
| เซนเซอร์ SHT31 | (I2C ไม่มีขาเดี่ยว) | `SHT31_Sensor` |
| โพเทนชิโอมิเตอร์ | `PIN.VR=36` | `POT_VR` |
| ปุ่มกด A/B | `PIN.BTN_A=0 / BTN_B=4` | `BTN_A` / `BTN_B` |
| จอ OLED | canvas `#oled` | `OLED_Screen` |
| ขา GPIO อื่นที่ไม่มีชื่ออุปกรณ์ | แต่ละ entry ใน `PARTS` | `GPIO_<เลขขา>` เช่น `GPIO_36` |

**ข้อกำหนดสำหรับ 3D artist ตอนสร้างโมเดลจริงใน Phase B**:
- ตั้งหน่วย Scene เป็น **Metric** และโมเดลบอร์ดที่สัดส่วนจริง ~5.5×2.8 ซม. (ขนาด ESP32 DevKit ทั่วไป) ให้ตรงกับสเกลที่ primitive ใช้ตั้งแต่ Phase A เพื่อไม่ต้อง rescale ทีหลัง
- ตั้งชื่อ Object ใน Outliner ให้ตรงตามตารางด้านบน**เป๊ะๆ** (ระวัง Blender auto-suffix `.001` เมื่อ duplicate ชิ้นส่วน)
- งบ polygon รวมทั้ง scene ไม่เกิน ~15,000 triangles, texture atlas ไม่เกิน 1K–2K ต่อ material (bake รายละเอียดเล็กๆ เช่น ตัวอักษร silkscreen ลงเท็กซ์เจอร์ ไม่ปั้นเป็น geometry) เพื่อให้ไฟล์ `.glb` เล็กพอสำหรับ static host ที่ไม่มี CDN
- Export เป็น `.glb` ไฟล์เดียวด้วย exporter `io_scene_gltf2` ที่ติดมากับ Blender (แปลงแกน Z-up→Y-up อัตโนมัติ ไม่ต้องทำมือ)
- ตรวจสอบความถูกต้อง: โค้ดฝั่ง `GLTFLoader` (Phase B) ควร log warning ถ้าชื่อ node ที่คาดไว้ในตารางหายไป หรือมีชื่อแปลกปลอมที่ไม่รู้จัก — ช่วยจับความผิดพลาดการตั้งชื่อได้ทันทีตอน dev

---

## 5. Three.js Implementation Plan

**Scene setup**: `PerspectiveCamera` + `OrbitControls` (damping เปิด, จำกัด min/max distance และ `maxPolarAngle` ไม่ให้กล้องทะลุลงใต้บอร์ด), แสง 1× `DirectionalLight` + 1× `AmbientLight` พอสำหรับ scene เรียบง่าย ไม่เปิด shadow map ในเฟส MVP

**การวางตำแหน่ง primitive**: แปลงพิกัด `PARTS[i].x/y` (พิกัดพิกเซลบนบอร์ด 2D เดิม) เป็นตำแหน่ง 3D ด้วย scale คงที่ (เช่น 1px = 1cm) ผ่านฟังก์ชัน `boardToScene(x,y)` เดียว — ทำให้ layout 3D เบื้องต้นหน้าตาตรงกับ 2D ที่ตรวจสอบแล้วว่าใช้งานได้จริง และเป็น reference pose ให้ 3D artist เทียบในเฟส B

**OLED → texture**: อ่านจาก `<canvas id="oled">` ตัวเดิม (ที่ `sim-engine.js` วาดอยู่แล้ว) มาเป็น `THREE.CanvasTexture` ติดบน `PlaneGeometry` ชื่อ `OLED_Screen` ใช้ `MeshBasicMaterial` (ไม่ติดแสง scene เพราะจอ OLED เรืองแสงเอง) ตั้ง `texture.needsUpdate = true` ทุกเฟรมที่อัปเดต (ต้นทุนต่ำมากที่ความละเอียดจริง 128×64)

**RGB LED → emissive material**: ใช้ `MeshStandardMaterial` พร้อม `emissive`/`emissiveIntensity` อ่านค่าสีจาก `snapshot()` (ที่ให้ค่าสีแบบ CSS string อยู่แล้ว) แปลงเป็น RGB แล้วกำหนดเข้า emissive ทุกเฟรม ตั้ง `toneMapped:false` ให้สี LED สดเสมอ

**รีเลย์/บัซเซอร์/ปุ่ม**: ใช้การสลับสี/emissive หรือ scale เล็กน้อยตามสถานะ boolean จาก `snapshot()` — ไม่ต้องเทคนิคใหม่เพิ่ม

**Raycasting/การคลิกขา GPIO**: ใช้ `THREE.Raycaster` จับ `pointermove`/`click` บน canvas จับคู่ชื่อ object ที่ชนกับ index ในอาเรย์ `PARTS` ผ่านตาราง lookup แล้ว**เรียก `showPart(i)` ฟังก์ชันเดิมตรงๆ** — popover `#partInfo` เดิมไม่ต้องแก้ไขอะไรเลย ชิ้นส่วนเล็ก (ปุ่ม, ขา header) ให้มี "hitbox" ล่องหนขนาดใหญ่กว่าโมเดลจริงเล็กน้อยไว้รับคลิก แก้ปัญหาคลิกพลาดที่ชิ้นส่วนเล็ก และวิธีนี้ใช้ต่อได้กับโมเดล Blender ใน Phase B โดยไม่ต้องเปลี่ยนแนวคิด

---

## 6. ESP32 Simulation Engine Plan

**ไม่แก้ไข `sim-engine.js`** ในเฟส MVP — คงอินเทอร์พรีเตอร์ Arduino C++ เดิม, `HW` state object เดิม, `PIN` map เดิม, run loop เดิมทั้งหมด ชั้น 3D อ่านข้อมูลผ่าน **public API ที่มีอยู่แล้วเท่านั้น** (`SPUSim.snapshot()`, `SPUSim.PIN` ถ้าจำเป็นต้องอ้างเลขขา) เพื่อให้ `sim-engine.js` ยังเป็นจุดเดียวที่ถือ "ความจริง" ของสถานะจำลอง ลดความเสี่ยงที่การเพิ่มชั้น 3D จะทำของเดิมพัง

จุดเดียวที่ **อาจ** แตะในอนาคต (ไม่ใช่ตอนนี้): ถ้าพบว่าการ poll ไม่พอ (ยังไม่มีสัญญาณว่าจำเป็น) ให้ monkey-patch ฟังก์ชัน public (`HW.digitalWrite` ฯลฯ) จาก "นอก" ไฟล์ `sim-engine.js` เพื่อยิง `CustomEvent` เสริม — บันทึกเป็นแนวทางสำรองที่ถูกเลื่อนออกไป ไม่ใช่งานของ MVP

---

## 7. UI/UX Design Structure

- ปุ่ม **"3D View" / "2D View"** toggle ที่แถบ toolbar บน (ข้างปุ่ม Run/Stop/Reset เดิม)
- เมื่ออยู่ใน 3D: canvas เต็มพื้นที่ `#stage` เดิม (แทนที่ `#board` ชั่วคราว ไม่ลบออกจาก DOM), แผง editor/console/pins-panel ด้านซ้าย-ขวาเดิม**ไม่เปลี่ยน**
- ปุ่ม **"Reset View"** เพื่อคืนกล้องกลับตำแหน่งเริ่มต้น (เก็บ quaternion/position เริ่มต้นไว้ตอน init)
- Hover ชิ้นส่วนใน 3D → cursor เปลี่ยนเป็น pointer + ไฮไลต์เล็กน้อย (emissive boost หรือ outline mesh ซ้อน) ให้ affordance คล้าย `.tag` เดิมใน 2D
- คลิกชิ้นส่วน → popover `#partInfo` เดิม เปิดแบบเดียวกับ 2D ทุกประการ (คอนเทนต์ไม่ต้องสร้างใหม่)
- รองรับ Desktop + Tablet (touch ผ่าน OrbitControls ในตัว) — **ไม่เน้น** ปรับแต่งเฉพาะมือถือจอเล็กในเฟสนี้ ตามแนวเดิมของโปรเจกต์

---

## 8. Data Flow Diagram

```
[ผู้ใช้เขียนโค้ด Arduino] → [กด Run]
        │
        ▼
sim-engine.js : Interp (รัน setup()/loop() ทีละ step ผ่าน generator)
        │  เขียนสถานะลง HW{ pinVal, pwm, ledc, wifi, ... } และ OLED canvas
        ▼
SPUSim.snapshot()  ◄── (public API, อ่านอย่างเดียว ไม่แก้ภายใน)
        │
        ├────────────────────────────┐
        ▼ (ทุก requestAnimationFrame) ▼
  2D UI: renderPins(S)        3D UI: board3d.update(S)
  (index.html เดิม)            (board3d.js ใหม่)
        │                            │
        ▼                            ▼
  DOM/.pin-row อัปเดต           Three.js scene:
                                 - OLED_Screen.map.needsUpdate (CanvasTexture จาก #oled)
                                 - RGB_LED.emissive ← สี LED
                                 - RELAY1/2, BUZZER, BTN_A/B ← สถานะ boolean/analog

[ผู้ใช้คลิกชิ้นส่วนใน 3D]
        │ Raycaster.intersectObjects()
        ▼
 lookup table (object.name → PARTS index)
        │
        ▼
 showPart(i)  ◄── ฟังก์ชันเดิมของ 2D ใช้ซ้ำตรงๆ
        │
        ▼
 #partInfo popover แสดงผล (เหมือนกันทั้ง 2D และ 3D)
```

---

## 9. Folder Structure

```
ESP32 simulator/
├── index.html                   (เดิม — เพิ่ม canvas, ปุ่ม toggle, import map, <script type="module">)
├── sim-engine.js                 (เดิม — ไม่แก้ไข)
├── board3d.js                    (ใหม่ — Phase A: scene, primitives, raycasting, update(S))
├── board3d-parts-map.js          (ใหม่ — ตาราง lookup PARTS ↔ ชื่อ object 3D จาก Section 4)
├── assets/
│   └── models/
│       └── board.glb             (ใหม่ — Phase B เท่านั้น ยังไม่มีในเฟส MVP)
├── vendor/                       (ใหม่ — เผื่อสำรอง กรณีไม่ใช้ CDN)
│   └── three/ ...
├── support.js                    (เดิม — ไฟล์หลงเหลือ ไม่เกี่ยวข้อง คงไว้เฉยๆ)
├── Dockerfile / docker-compose.yml / nginx.conf   (เดิม — ไม่ต้องแก้ นอกจากตรวจสอบ MIME type ของ .glb ใน Phase B)
```

ไม่มีการเพิ่ม `package.json`, `node_modules`, หรือ build step ใดๆ

---

## 10. Development Roadmap

**Phase A — Primitive 3D Board (MVP เป้าหมายใกล้สุด ลงมือได้ทันที)**
งาน: สร้าง `board3d.js` + `board3d-parts-map.js`, scene primitive ตามตาราง Section 4, raycasting/popover เชื่อม `showPart()`, sync OLED/LED/รีเลย์/ปุ่มแบบ real-time, OrbitControls + Reset View, ปุ่ม toggle 2D/3D
เครื่องมือ: เบราว์เซอร์ + editor ปัจจุบัน, Three.js CDN
ผลลัพธ์คาดหวัง: ดูเกณฑ์ "MVP Done" ใน Section 12

**Phase B — Blender Realistic Asset**
งาน: ปั้นโมเดลจริงใน Blender ตาม naming convention เดิม, texture/material, export `board.glb`, เปลี่ยน `board3d.js` ให้โหลดผ่าน `GLTFLoader` แทนการสร้าง primitive (คง lookup table และตรรกะ raycasting/OLED/LED เดิมทั้งหมด)
เครื่องมือ: Blender (ฟรี ไม่มีต้นทุน)
ผลลัพธ์คาดหวัง: โมเดลสมจริงแทนที่กล่อง/ทรงกระบอก โดย interaction ทั้งหมดยังทำงานเหมือน Phase A

**Phase C — Polish**
งาน: tooltip/label แบบลอย (Sprite หรือ HTML overlay), แอนิเมชันเล็กๆ (รีเลย์คลิก, ปุ่มยุบตัว, LED เรืองจังหวะ), พิจารณาโหมดแสดงผล 2D/3D แบบ side-by-side

**Phase D — เลื่อนออกไปอย่างชัดเจน (ไม่อยู่ใน roadmap นี้)**
ระบบ drag-and-drop circuit editor แบบทั่วไป (ให้ผู้ใช้ลากอุปกรณ์ภายนอกมาวางและต่อสายเอง) ตามที่ระบุในแนวคิดตั้งต้น — ต้องออกแบบ data model ใหม่ทั้งหมด (component graph แทนอาเรย์ `PARTS` ตายตัว) เป็นโครงการแยกในอนาคต ไม่ประเมินเวลา/ขอบเขตในแผนนี้

---

## 11. Technical Challenges and Solutions

| ความเสี่ยง/ข้อจำกัด | แนวทางแก้ |
|---|---|
| Layout/z-index ชนกันระหว่าง canvas 3D กับ `#board`/`#stage` ที่ scale ด้วย CSS | ใช้ toggle ซ่อน/แสดง ไม่วางซ้อนกันในเฟส MVP |
| ต้นทุนอัปเดต CanvasTexture ของ OLED ทุกเฟรม | อ่านจาก canvas ความละเอียดจริง 128×64 ไม่ใช่เวอร์ชันขยายด้วย CSS |
| ขนาดไฟล์ `.glb` บน static host ไม่มี CDN (Phase B) | จำกัด poly ~15k triangles, texture ≤2K, เปิด gzip/brotli ใน nginx, แสดง progress bar ตอนโหลด |
| คลิกพลาดชิ้นส่วนเล็ก (ปุ่ม, ขา header) | ใช้ hitbox ล่องหนขนาดใหญ่กว่าโมเดลจริงสำหรับ raycasting |
| คง `sim-engine.js` ไม่ให้ถูกแก้ | ออกแบบทุกจุดเชื่อมต่อผ่าน public API (`snapshot()`) เท่านั้น ถ้าจำเป็นต้อง patch ในอนาคตให้ทำจากไฟล์ `board3d.js` ไม่แก้ไฟล์ interpreter |
| แกน/สเกลไม่ตรงกันระหว่าง Blender (Z-up) กับ Three.js/glTF (Y-up) | ใช้ glTF exporter ของ Blender ที่แปลงแกนอัตโนมัติ, กำหนดสเกลจริง 1:1 เมตรตั้งแต่ Phase A ให้ Phase B อ้างอิงตรงกัน |
| ตั้งชื่อ Object ผิดใน Blender (Blender auto-suffix `.001`) | เช็กลิสต์ชื่อก่อน export + ให้โค้ด `GLTFLoader` log warning เมื่อชื่อที่คาดไว้หายไป |
| เวอร์ชัน Three.js จาก CDN เปลี่ยนโดยไม่ตั้งใจ | pin เวอร์ชันระบุเจาะจงใน import map ไม่ใช้ `@latest` |
| ไม่มี build step = ไม่มี type-check | ยอมรับเป็น trade-off ที่มีอยู่แล้วในโปรเจกต์ (sim-engine.js เดิมก็ไม่มี build-time check เช่นกัน) |
| ต้นทุน Blender | ไม่มี (ซอฟต์แวร์ฟรี GPL) ต้นทุนเดียวคือเวลาเรียนรู้ของผู้พัฒนา ไม่ใช่ตัวบล็อก Phase A |

---

## 12. MVP Scope และแนวทางพัฒนาระยะต่อไป

**MVP = Phase A เท่านั้น** ถือว่าเสร็จเมื่อครบทุกข้อ:
1. มีปุ่มสลับ 2D/3D โดยมุมมอง 2D เดิมยังทำงานถูกต้อง 100% (ไม่มี regression)
2. Scene 3D มี primitive ตรงกับทุก entry ในตาราง naming (Section 4) จัดวางตามตำแหน่งที่แปลงจาก `PARTS[i].x/y`
3. คลิกชิ้นส่วนใดๆ ใน 3D เปิด `#partInfo` ด้วยข้อมูลถูกต้อง (ครบทุกชิ้นส่วน ไม่ใช่แค่ตัวอย่างเดียว)
4. Hover แสดงไฮไลต์/cursor ก่อนคลิก
5. `OLED_Screen` แสดงภาพตรงกับ `#oled` จริงแบบ real-time (ทดสอบด้วยตัวอย่างสเกตช์ที่วาดจอ OLED)
6. `RGB_LED` ไล่สี/ความสว่างตรงกับสถานะจริงรวมถึงสถานะดับ
7. `RELAY1`/`RELAY2` เปลี่ยนสถานะภาพตรงกับการจำลองพลังงาน
8. `BTN_A`/`BTN_B` ต้องตัดสินใจและบันทึกให้ชัดว่าคลิกจาก 3D ส่งผลเป็น input จริงหรือสะท้อนสถานะอย่างเดียว
9. OrbitControls หมุน/แพน/ซูมได้ และปุ่ม Reset View คืนกล้องตำแหน่งเดิมได้
10. ไม่มีการแก้ไข `sim-engine.js` เลยเพื่อให้ได้ผลลัพธ์ข้างต้น
11. เฟรมเรตลื่นไหล ไม่มีอาการสะดุดที่สังเกตได้บนโน้ตบุ๊กทั่วไประหว่างรันสเกตช์

**แนวทางระยะต่อไป**: หลัง Phase A ผ่านเกณฑ์ จึงเริ่ม Phase B (โมเดล Blender สมจริง) โดยใช้ naming convention เดียวกันแบบ drop-in แทนที่ primitive, ตามด้วย Phase C (polish ภาพ/แอนิเมชัน) Phase D (ระบบต่อวงจรแบบลาก-วาง อุปกรณ์หลากหลาย) เป็นข้อเสนอโครงการแยกในอนาคต ไม่รวมอยู่ใน roadmap ของแผนนี้ และควรประเมินขอบเขต/เวลาใหม่เมื่อถึงเวลานั้น
