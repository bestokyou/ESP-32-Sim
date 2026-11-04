/* board3d.js — ชั้นแสดงผล 3D เสริม (Three.js) บน ESP32 Board Simulator
 * ตามแผน 3D-SIMULATOR-PLAN.md
 *
 * Phase B: โหลดโมเดลจริงจาก assets/models/board.glb (ปั้นใน Blender ตามตาราง Section 4)
 * ผ่าน GLTFLoader ก่อนเป็นอันดับแรก — ถ้าโหลดไม่สำเร็จ หรือหา node ชื่อที่คาดไว้ไม่เจอ
 * (ไฟล์เสีย/ไม่มีไฟล์/ตั้งชื่อผิดตอน export) จะ log warning แล้ว fallback ไปสร้าง
 * primitive geometry แทนที่ชิ้นส่วนนั้นๆ โดยอัตโนมัติ (Phase A เดิม) — ไม่ทำให้หน้าเว็บพัง
 *
 * ไม่แก้ไข sim-engine.js — อ่านสถานะผ่าน ESP32Sim.snapshot() ที่ส่งเข้ามาทาง update(s) เท่านั้น
 * ตำแหน่งชิ้นส่วนอ่านจากอาเรย์ PARTS เดิมของ index.html (ส่งเข้ามาผ่าน hooks.getParts())
 * ชื่อ Object 3D มาจาก board3d-parts-map.js (index ต้องตรงกับ PARTS) — ชื่อเดียวกันนี้
 * ต้องตรงกับชื่อ Object ใน Blender เป๊ะๆ (ดูหมายเหตุใน board3d-parts-map.js)
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { PART_NAMES_3D } from "./board3d-parts-map.js";

/* พิกัดบอร์ด 2D เดิมใน index.html คือ 560×500 px (ดู <svg class="pcb" viewBox="0 0 560 500">) */
const BOARD_PX_W = 560, BOARD_PX_H = 500;
/* สเกล 1px → ~0.25mm ทำให้บอร์ดทั้งแผ่นกว้างจริงประมาณ 14×12.5 ซม. (หน่วย Three.js = เมตร)
 * ค่านี้คือ "สัญญาที่ตายตัว" ระหว่าง Phase A/B: สคริปต์ปั้นโมเดลใน Blender ก็ใช้ค่าเดียวกันนี้
 * (ดูตัวแปร PX_W/PX_H/SCALE ในสคริปต์ที่ใช้ปั้น assets/models/board.glb) */
const SCALE = 0.14 / BOARD_PX_W;
const BOARD_THICKNESS = 0.0016; // 1.6mm ความหนา PCB มาตรฐาน
const MODEL_URL = new URL("./assets/models/board.glb", import.meta.url).href;

/* แปลงพิกัด 2D (origin บนซ้าย, x ขวา, y ลง) → ตำแหน่งบนพื้นระนาบ 3D (Y-up, origin กลางบอร์ด) */
function boardToScene(x, y) {
  return { x: (x - BOARD_PX_W / 2) * SCALE, z: (y - BOARD_PX_H / 2) * SCALE };
}

/* ---------------- Procedural textures ----------------
 * board.glb ที่ปั้นจาก Blender ยังไม่มี UV texture จริง (วัสดุเป็นสีตันล้วน) การทำ texture
 * จริงต้อง UV-unwrap + bake ใน Blender ซึ่งเป็นงานคนละขั้นตอน — ส่วนนี้จึงสร้าง texture
 * ทดแทนด้วย <canvas> ฝั่ง Three.js แทน (ลาย solder mask + ลายเส้นทองแดงบน PCB, และ
 * noise สำหรับ roughnessMap ทั่วไป) เพื่อให้พื้นผิวมีรายละเอียดแทนที่จะเป็นสีตันล้วน
 * ถ้าในอนาคตมีการทำ texture จริงใน Blender (material.map ติดมากับ .glb แล้ว) โค้ดนี้จะ
 * ไม่ทับของจริง (ดู applyProceduralTexture ด้านล่าง)
 */
let _pcbColorTex = null;
let _noiseRoughTex = null;

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function makePCBColorTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#2568d6");
  grad.addColorStop(1, "#123f80");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // เกรนละเอียดจำลองผิว solder mask ไม่ให้เรียบเป็นพลาสติกเกินจริง
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    d[i] = clamp255(d[i] + n);
    d[i + 1] = clamp255(d[i + 1] + n);
    d[i + 2] = clamp255(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);

  // ลายเส้นทองแดง (copper trace) หักมุมฉากแบบ PCB จริง พร้อมจุด via ที่ปลายเส้น
  ctx.lineCap = "round";
  for (let i = 0; i < 48; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    const segs = 2 + Math.floor(Math.random() * 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segs; s++) {
      if (Math.random() < 0.5) x += (Math.random() - 0.5) * 120;
      else y += (Math.random() - 0.5) * 120;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = Math.random() < 0.5 ? "rgba(255,214,120,0.22)" : "rgba(210,228,255,0.18)";
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,214,120,0.3)";
    ctx.fill();
  }

  // vignette ทำให้ขอบมืดลงเล็กน้อย จำลอง ambient occlusion แบบ bake คร่าวๆ
  const vg = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeNoiseRoughnessTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b0b0b0"; // ค่า roughness กลางๆ เป็นฐาน (roughnessMap เป็น non-color data, ไม่ต้องตั้ง colorSpace)
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const g = 120 + Math.random() * 110;
    ctx.fillStyle = "rgba(" + g + "," + g + "," + g + "," + (0.08 + Math.random() * 0.1) + ")";
    const r = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

function getPCBColorTexture() {
  if (!_pcbColorTex) _pcbColorTex = makePCBColorTexture();
  return _pcbColorTex;
}

function getNoiseRoughnessTexture() {
  if (!_noiseRoughTex) _noiseRoughTex = makeNoiseRoughnessTexture();
  return _noiseRoughTex;
}

let _pinStripTex = null;

/* ลาย pin header: แถบพิน (เงินไล่โทน จำลองผิวโลหะมันวาว) สลับกับฐานพลาสติกสีดำ — baked
 * เป็นภาพเดียว 8 พิน แล้วแปะทับพื้นผิวยาวของตัว GPIO_Header เลย ไม่ต้องพึ่ง repeat เพราะ
 * ไม่รู้ล่วงหน้าว่า UV จาก Blender (ถ้ามี) จะ unwrap แนวไหน */
function makePinStripTexture() {
  const w = 256, h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#15181c";
  ctx.fillRect(0, 0, w, h);
  const pins = 8;
  const pinW = w / pins;
  for (let i = 0; i < pins; i++) {
    const cx = i * pinW + pinW / 2;
    const grad = ctx.createLinearGradient(cx - pinW * 0.22, 0, cx + pinW * 0.22, 0);
    grad.addColorStop(0, "#8a9098");
    grad.addColorStop(0.5, "#eef1f4");
    grad.addColorStop(1, "#6f757d");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - pinW * 0.22, 0, pinW * 0.44, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getPinStripTexture() {
  if (!_pinStripTex) _pinStripTex = makePinStripTexture();
  return _pinStripTex;
}

/* ค่า roughness/metalness ต่อชิ้นส่วน — ใช้ทั้งกับ primitive fallback (Phase A) และทับค่า
 * default ของ material ที่มากับ board.glb (Phase B, ดูการใช้งานใน buildFromGLTF) เพราะค่า
 * ที่ export จาก Blender ตอนนี้เป็นค่า default ของ Principled BSDF ล้วนๆ (roughness 0.5,
 * metalness 0 แทบทุกชิ้น) ยังไม่ได้ปรับให้เข้ากับวัสดุจริงของแต่ละชิ้น */
const PART_MATERIAL_HINTS = {
  RELAY1: { roughness: 0.8, metalness: 0.0 },
  RELAY2: { roughness: 0.8, metalness: 0.0 },
  BUZZER: { roughness: 0.82, metalness: 0.0 }, // ตัวเรือนพลาสติกดำ ไม่ใช่โลหะ
  BTN_A: { roughness: 0.8, metalness: 0.0 },
  BTN_B: { roughness: 0.8, metalness: 0.0 },
  POT_VR: { roughness: 0.7, metalness: 0.0 },
  SHT31_Sensor: { roughness: 0.65, metalness: 0.0 },
  ESP32_Board: { roughness: 0.6, metalness: 0.1 },
  USB_Port: { roughness: 0.3, metalness: 0.6 },
  RST_Button: { roughness: 0.8, metalness: 0.0 },
  GPIO_Header: { roughness: 0.78, metalness: 0.0 }, // ฐานพลาสติก — ตัวพินเป็น object แยก (GPIO_Header_Pins)
};

/* ผิวพลาสติกด้านมีเกรน (textured plastic) สำหรับชิ้นสีเข้ม — normal map เป็นหลุมนูนละเอียด + roughness
 * แปรผันตามลายเดียวกัน ทำจาก value noise แบบ tile ได้ (ต่อขอบซ้ายขวา/บนล่างไม่เห็นรอยต่อ) */
let _plasticTex = null;

function makePlasticTextures() {
  const size = 256, cells = 48;
  const grid = new Float32Array(cells * cells).map(() => Math.random());
  const g = (x, y) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy);
      const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * tx;
      const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * tx;
      h[y * size + x] = a + (b - a) * ty + (Math.random() - 0.5) * 0.25; // เกรนใหญ่ + เกรนละเอียดระดับ pixel
    }
  }
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const nc = document.createElement("canvas"), rc = document.createElement("canvas");
  nc.width = nc.height = rc.width = rc.height = size;
  const nImg = nc.getContext("2d").createImageData(size, size), rImg = rc.getContext("2d").createImageData(size, size);
  const k = 2.2; // ความชันของหลุมนูน
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      nImg.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      nImg.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      nImg.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      nImg.data[i + 3] = 255;
      const r = clamp255((0.8 + (at(x, y) - 0.5) * 0.18) * 255); // roughness ราว 0.7–0.9
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = r;
      rImg.data[i + 3] = 255;
    }
  }
  nc.getContext("2d").putImageData(nImg, 0, 0);
  rc.getContext("2d").putImageData(rImg, 0, 0);
  const normal = new THREE.CanvasTexture(nc), rough = new THREE.CanvasTexture(rc);
  [normal, rough].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
  return { normal, rough };
}

function getPlasticTextures() {
  if (!_plasticTex) _plasticTex = makePlasticTextures();
  return _plasticTex;
}

/* UV แบบ box projection ตามทิศ normal ของแต่ละ vertex ที่ความหนาแน่นคงที่ (1 tile ต่อ PLASTIC_TILE เมตร)
 * — planar จากด้านบนอย่างเดียว (ensurePlanarUV) จะยืดลายบนด้านข้างของชิ้นเป็นเส้นๆ และขนาดเกรน
 * จะไม่เท่ากันระหว่างชิ้นเล็กกับชิ้นใหญ่ */
const PLASTIC_TILE = 0.006;
function ensureBoxUV(geometry) {
  if (!geometry || geometry.attributes.uv || !geometry.attributes.normal) return;
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [pos.getX(i), pos.getZ(i)] : ax >= az ? [pos.getZ(i), pos.getY(i)] : [pos.getX(i), pos.getY(i)];
    uvs[i * 2] = u / PLASTIC_TILE;
    uvs[i * 2 + 1] = v / PLASTIC_TILE;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

/* ชิ้นสีเข้มที่ไม่ใช่โลหะ (ปุ่ม, buzzer, relay, ฐาน header, ขั้วต่อ ฯลฯ) → พลาสติกด้านมีเกรน
 * ลดแสงสะท้อนจาก environment ลงด้วย ไม่งั้นแม้ roughness สูงก็ยังดูเคลือบเงาจากภาพห้องจำลอง */
function applyPlasticFinish(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const dark = materials.filter((m) => m && m.isMeshStandardMaterial && !m.map && m.metalness < 0.3 &&
    Math.max(m.color.r, m.color.g, m.color.b) < 0.25);
  if (!dark.length) return;
  ensureBoxUV(mesh.geometry);
  const { normal, rough } = getPlasticTextures();
  dark.forEach((m) => {
    m.roughness = 1.0; // roughnessMap คูณกับค่านี้ → ได้ราว 0.7–0.9 ตามลาย
    m.roughnessMap = rough;
    m.metalness = 0;
    m.normalMap = normal;
    m.normalScale.set(0.35, 0.35);
    m.envMapIntensity = 0.6;
    m.needsUpdate = true;
  });
}

/* mesh จาก Blender export ไม่ได้ UV-unwrap มาด้วย (geometry.attributes.uv ไม่มีเลย) ถ้าไม่สร้าง UV
 * เองก่อน การใส่ map/roughnessMap จะไม่เห็นผลอะไรเลย (สุ่มตัวอย่าง texture จากจุดเดียวซ้ำๆ จนดูเป็น
 * สีตันเหมือนเดิม) — ใช้ planar projection มองจากด้านบน (แกน X/Z) ซึ่งพอสำหรับชิ้นส่วนแบนบนบอร์ด
 * (ไม่ครอบคลุมทุกกรณี เช่นทรงกระบอกตั้ง แต่ดีกว่าไม่มี UV เลย) */
function ensurePlanarUV(geometry) {
  if (!geometry || geometry.attributes.uv) return;
  const pos = geometry.attributes.position;
  if (!pos) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const sx = bb.max.x - bb.min.x || 1;
  const sz = bb.max.z - bb.min.z || 1;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) - bb.min.x) / sx;
    uvs[i * 2 + 1] = (pos.getZ(i) - bb.min.z) / sz;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

/* เติม texture ให้ mesh เฉพาะตอนที่ยังไม่มีของจริงติดมา (กัน texture จริงจาก Blender ถูกทับ) */
function applyProceduralTexture(mesh, { map, roughnessMap, tintWhite } = {}) {
  if (!mesh || !mesh.isMesh) return;
  if (map || roughnessMap) ensurePlanarUV(mesh.geometry);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => {
    if (!material || !material.isMeshStandardMaterial) return;
    if (map && !material.map) {
      material.map = map;
      if (tintWhite) material.color.set(0xffffff);
    }
    if (roughnessMap && !material.roughnessMap) material.roughnessMap = roughnessMap;
    material.needsUpdate = true;
  });
}

function makePrimitiveMesh(name3d) {
  switch (name3d) {
    case "RGB_LED":
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, 0.012),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, toneMapped: false })
      );
    case "RELAY1":
    case "RELAY2":
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.014, 0.024),
        new THREE.MeshStandardMaterial({ color: 0x2c333b, emissive: 0x000000, roughness: 0.65, metalness: 0.1, roughnessMap: getNoiseRoughnessTexture() })
      );
    case "BUZZER":
      return new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.01, 24),
        new THREE.MeshStandardMaterial({ color: 0x2c333a, emissive: 0x000000, roughness: 0.35, metalness: 0.7, roughnessMap: getNoiseRoughnessTexture() })
      );
    case "BTN_A":
    case "BTN_B":
      return new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.006, 16),
        new THREE.MeshStandardMaterial({ color: 0x335577, roughness: 0.5, metalness: 0.0, roughnessMap: getNoiseRoughnessTexture() })
      );
    case "POT_VR":
      return new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.012, 16),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4, metalness: 0.2, roughnessMap: getNoiseRoughnessTexture() })
      );
    case "SHT31_Sensor":
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.004, 0.006),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0 })
      );
    case "ESP32_Board":
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.034, 0.006, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.45, metalness: 0.35, roughnessMap: getNoiseRoughnessTexture() })
      );
    case "USB_Port":
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.006, 0.008),
        new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.3, metalness: 0.6, roughnessMap: getNoiseRoughnessTexture() })
      );
    case "RST_Button":
      return new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16),
        new THREE.MeshStandardMaterial({ color: 0xe5484d, roughness: 0.55, metalness: 0.0 })
      );
    case "GPIO_Header":
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.006, 0.01, 0.03),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.4, map: getPinStripTexture(), roughnessMap: getNoiseRoughnessTexture() })
      );
    default:
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.008, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.1 })
      );
  }
}

function makePrimitiveBoardBase() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_PX_W * SCALE, BOARD_THICKNESS, BOARD_PX_H * SCALE),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.08,
      map: getPCBColorTexture(),
      roughnessMap: getNoiseRoughnessTexture(),
    })
  );
  mesh.name = "ESP32_Board_PCB";
  mesh.position.y = -BOARD_THICKNESS / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ getParts: () => Array, onSelect: (i:number) => void, getOledCanvas: () => HTMLCanvasElement|null,
 *           onLabels?: (pts: Array<{index:number, x:number, y:number, visible:boolean}>) => void }} hooks
 * @returns {{ show():void, hide():void, update(snapshot):void, resetView():void, setTheme(name:"light"|"dark"):void, dispose():void }}
 */
export function initBoard3D(canvas, hooks) {
  const { getParts, onSelect, getOledCanvas, onLabels } = hooks;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // ปรับ tone mapping/color space ให้ใกล้เคียงตาจริง — ไม่งั้นภาพจาก MeshStandardMaterial
  // จะดู "จืด" เพราะค่าสีไม่ถูก roll-off โทนสว่าง/มืดแบบกล้องจริง
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral (Khronos PBR Neutral) แทน ACES — ทุก pixel ผ่าน tone mapping ที่ OutputPass (รวมถึง RGB LED
  // ซึ่งตั้ง toneMapped=false ไว้ก็ไม่มีผลเมื่อวาดผ่าน composer) และ ACES บิดสีอิ่มตัว: น้ำเงินเป็นม่วง แดงเป็นส้ม
  // Neutral คงเฉดสีเดิมไว้ บีบเฉพาะส่วนที่สว่างจัดเท่านั้น
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Image-based lighting จาก "ห้องจำลอง" (RoomEnvironment) — แหล่งกำเนิดแสงจริงอย่างเดียว
  // (ambient/directional) ทำให้พื้นผิว PBR เรียบเป็นสีตันไม่มีมิติ เพราะไม่มี reflection ให้มองเห็น
  // ทรงของวัตถุ ส่วนนี้คือสิ่งที่แก้ปัญหา "ดูแบน ไม่มีมิติ" ได้มากที่สุด
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10);
  const initialCamPos = new THREE.Vector3(0.14, 0.16, 0.18);
  camera.position.copy(initialCamPos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.minDistance = 0.08;
  controls.maxDistance = 0.6;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // กันกล้องทะลุลงใต้บอร์ด

  // Three-point lighting: hemisphere เป็น fill แบบนุ่ม (จำลองแสงสะท้อนจากท้องฟ้า/พื้น)
  // + key light หลักที่ทอดเงา + fill light อ่อนฝั่งตรงข้ามลด contrast ของเงาไม่ให้ดำสนิท
  scene.add(new THREE.HemisphereLight(0x9fc3ff, 0x11131a, 0.8));

  const dirLight = new THREE.DirectionalLight(0xfff3e0, 2.4);
  dirLight.position.set(0.22, 0.32, 0.18);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.bias = -0.0003;
  dirLight.shadow.normalBias = 0.0015;
  const SH = 0.11; // กรอบ ortho ของ shadow camera ครอบคลุมบอร์ด (~0.14×0.125ม.) พอดี
  dirLight.shadow.camera.left = -SH;
  dirLight.shadow.camera.right = SH;
  dirLight.shadow.camera.top = SH;
  dirLight.shadow.camera.bottom = -SH;
  dirLight.shadow.camera.near = 0.05;
  dirLight.shadow.camera.far = 0.8;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xbcd4ff, 0.5);
  fillLight.position.set(-0.2, 0.18, -0.12);
  scene.add(fillLight);

  /* ---------------- พื้นตารางแบบ viewport ของ Blender ---------------- */
  // วาดเส้นด้วย shader (fwidth) แทน GridHelper — เส้นคมเท่ากันทุกระยะ ไม่กะพริบ และจางหายตามระยะ
  // เหมือนพื้นใน Blender: เส้นย่อยทุก 1 ซม. เส้นหลักทุก 10 ซม. แกน X แดง / แกน Y (ของ Blender = Z ของ three) เขียว
  const groundGroup = new THREE.Group();
  scene.add(groundGroup);

  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    extensions: { derivatives: true },
    uniforms: {
      uMinor: { value: new THREE.Color() },
      uMajor: { value: new THREE.Color() },
      uAxisX: { value: new THREE.Color() },
      uAxisZ: { value: new THREE.Color() },
      uMinorStep: { value: 0.01 },
      uMajorStep: { value: 0.1 },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uMinor, uMajor, uAxisX, uAxisZ;
      uniform float uMinorStep, uMajorStep;
      varying vec3 vWorld;
      // จางเส้นออกเมื่อช่องตารางเล็กกว่าไม่กี่ pixel (มุมเอียง/ระยะไกล) — ไม่งั้นเส้นถี่เกิน pixel
      // จะเกิด moire กะพริบตอนกล้องขยับ (แบบเดียวกับที่ Blender ซ่อนระดับตารางที่ละเอียดเกินไป)
      float gridLine(vec2 p, float stepSize, float width) {
        vec2 c = p / stepSize;
        vec2 d = fwidth(c);
        vec2 g = abs(fract(c - 0.5) - 0.5) / d;
        float line = 1.0 - min(min(g.x, g.y) / width, 1.0);
        return line * (1.0 - smoothstep(0.12, 0.3, max(d.x, d.y)));
      }
      float axisLine(float v, float width) {
        return 1.0 - min(abs(v) / (max(fwidth(v), 1e-6) * width), 1.0);
      }
      void main() {
        float dist = length(cameraPosition - vWorld);
        float minor = gridLine(vWorld.xz, uMinorStep, 1.0) * (1.0 - smoothstep(0.3, 0.9, dist));
        float major = gridLine(vWorld.xz, uMajorStep, 1.4);
        float ax = axisLine(vWorld.z, 1.6);
        float az = axisLine(vWorld.x, 1.6);
        vec3 col = mix(uMinor, uMajor, major);
        float a = max(minor * 0.8, major);
        col = mix(col, uAxisX, ax); a = max(a, ax);
        col = mix(col, uAxisZ, az); a = max(a, az);
        gl_FragColor = vec4(col, a * (1.0 - smoothstep(0.35, 1.6, dist)));
      }`,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.renderOrder = 1;
  groundGroup.add(grid);

  // เงาของบอร์ดตกลงบนพื้น (ShadowMaterial โปร่งใส เห็นแค่เงา) ให้บอร์ดดูวางอยู่บนพื้นจริง ไม่ลอย
  // พื้นเงากับตารางอยู่ระนาบเดียวกัน — ถ้าพื้นเงาเขียน depth ตารางจะ z-fight กับมันจนกะพริบ
  // จึงปิด depthWrite แล้วกำหนดลำดับวาดเอง (เงาก่อน ตารางทับ) แทน
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.3, depthWrite: false });
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), shadowMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  shadowFloor.renderOrder = 0;
  groundGroup.add(shadowFloor);

  // วางพื้นไว้ใต้จุดต่ำสุดของโมเดล (เรียกหลังโหลดเสร็จ — ใต้บอร์ดอาจมีขา pin ยื่นลงมา)
  function fitGround() {
    const box = new THREE.Box3();
    scene.children.forEach((o) => { if (o !== groundGroup) box.expandByObject(o); });
    if (!box.isEmpty()) groundGroup.position.y = box.min.y - 0.0003;
  }

  // โทนสีตามธีมของหน้าเว็บ (data-theme บน <html>) — สีเทากลางแบบ Blender ในโหมดมืด, เทาอ่อนในโหมดสว่าง
  const THEMES = {
    dark:  { bg: 0x393939, minor: 0x4a4a4a, major: 0x5e5e5e, axisX: 0xc8414f, axisZ: 0x6f9a2b, shadow: 0.35 },
    light: { bg: 0xeef1f5, minor: 0xd8dde4, major: 0xb9c1cc, axisX: 0xe0525f, axisZ: 0x7fb23a, shadow: 0.16 },
  };
  function setTheme(name) {
    const t = THEMES[name] || THEMES.light;
    scene.background = new THREE.Color(t.bg);
    gridMat.uniforms.uMinor.value.set(t.minor);
    gridMat.uniforms.uMajor.value.set(t.major);
    gridMat.uniforms.uAxisX.value.set(t.axisX);
    gridMat.uniforms.uAxisZ.value.set(t.axisZ);
    shadowMat.opacity = t.shadow;
    renderOnce();
  }

  const partGroup = new THREE.Group(); // ชิ้นส่วน primitive (fallback) ทั้งหมด
  scene.add(partGroup);

  const byName = new Map(); // name3d -> visual mesh (จากโมเดลจริงหรือ primitive สำรอง)
  const pickables = []; // { visualMesh, index, anchor }
  const oledState = { texture: null };

  // pick จากรูปทรงจริงของชิ้นส่วน — เดิมใช้ hitbox ลูกบาศก์ 22มม. วางตามพิกัด 2D ซึ่งใหญ่กว่า
  // ชิ้นเล็กๆ (LED/ปุ่ม) ซ้อนทับชิ้นข้างเคียง และพอมองเอียงๆ ก็ยื่นออกนอกตัวชิ้น ทำให้เมาส์ไม่ตรงก็ไฮไลต์
  function addPickable(name3d, index) {
    const visualMesh = byName.get(name3d);
    // anchor = กึ่งกลางผิวบนของชิ้น ใช้วางจุดป้ายชื่อ (ปุ่ม "รายละเอียด") ให้ตรงกับโมเดล 3D
    // ต้อง update matrix ทั้งฉากก่อน เพราะ Box3.setFromObject ไม่อัปเดต matrix ของ parent ให้
    scene.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(visualMesh);
    const anchor = box.getCenter(new THREE.Vector3());
    anchor.y = box.max.y;
    pickables.push({ visualMesh, index, anchor });
  }

  /* ---------------- Phase A fallback: สร้าง primitive geometry ล้วนๆ ---------------- */
  function buildPrimitives() {
    scene.add(makePrimitiveBoardBase());

    const parts = getParts();
    parts.forEach((p, i) => {
      const name3d = PART_NAMES_3D[i] || "PART_" + i;
      const { x, z } = boardToScene(p.x, p.y);
      let mesh;

      if (name3d === "OLED_Screen") {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.038), new THREE.MeshBasicMaterial({ color: 0x225599 }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0.0006, z);
        wireOled(mesh, false);
      } else {
        mesh = makePrimitiveMesh(name3d);
        const h = mesh.geometry.parameters.height || 0.01;
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      mesh.name = name3d;
      partGroup.add(mesh);
      byName.set(name3d, mesh);
      addPickable(name3d, i);
    });
  }

  /* ---------------- Phase B: ใช้โมเดลจาก Blender (board.glb) ---------------- */
  function wireOled(mesh, fromGltf) {
    const oledCanvas = getOledCanvas();
    const tex = oledCanvas ? new THREE.CanvasTexture(oledCanvas) : null;
    // UV ของ plane ที่ export จาก Blender (glTF) ใช้ขนบ top-left origin อยู่แล้ว ตรงข้ามกับ
    // PlaneGeometry primitive ของ Three.js เอง (bottom-left) — flipY ปกติของ CanvasTexture
    // (true, ขนบ bottom-left) จึงใช้ได้กับ primitive เท่านั้น ส่วนโมเดลจาก .glb ต้องปิด flipY
    // ไม่งั้นภาพจะกลับหัว+สลับฝั่งไปพร้อมกัน
    if (tex) tex.flipY = !fromGltf;
    oledState.texture = tex;
    mesh.material = new THREE.MeshBasicMaterial({ color: tex ? 0xffffff : 0x225599, map: tex });
  }

  function buildFromGLTF(gltf) {
    const root = gltf.scene;
    scene.add(root);

    const pcb = root.getObjectByName("ESP32_Board_PCB");
    if (!pcb) {
      console.warn('[board3d] ไม่พบ node ชื่อ "ESP32_Board_PCB" ใน board.glb — ใช้ primitive สำรองแทนฐาน PCB');
      scene.add(makePrimitiveBoardBase());
    } else {
      // ลาย PCB ที่ export จาก Blender ยังไม่มี texture จริง (ดูหมายเหตุที่ applyProceduralTexture
      // ด้านบน) — ใส่ลาย solder mask/ลายเส้นทองแดงแบบ procedural ทับสีตันเดิมเฉพาะตอนที่ยังไม่มี
      // texture จริงติดมา เพื่อให้ Phase ต่อไปใส่ texture จริงใน Blender แล้วมาทับของเดิมได้เลย
      applyProceduralTexture(pcb, { map: getPCBColorTexture(), roughnessMap: getNoiseRoughnessTexture(), tintWhite: true });
    }

    // glTF จาก Blender ไม่ได้ติด castShadow/receiveShadow มาด้วย (ค่าเริ่มต้นของ three.js
    // คือ false ทั้งคู่) — ถ้าไม่เปิดเอง ชิ้นส่วนบนบอร์ดจะลอยไม่มีเงาเลย ดูแบนทั้งที่มี key light แล้ว
    // ส่วนชิ้นที่ยังเป็นสีตันไม่มี texture/roughnessMap (ยกเว้น RGB_LED/OLED_Screen ที่จัดการแยก
    // อยู่แล้ว) ก็เติม noise roughnessMap + ปรับ roughness/metalness ตาม PART_MATERIAL_HINTS
    // ให้ตรงกับวัสดุจริงของชิ้นนั้นๆ (ค่าที่ export จาก Blender ตอนนี้เป็นค่า default ของ
    // Principled BSDF ล้วนๆ) และ GPIO_Header ได้ลาย pin-strip แทนสีตันด้วย
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.name === "RGB_LED" || o.name === "OLED_Screen") return;

      const hint = PART_MATERIAL_HINTS[o.name];
      if (hint) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => {
          if (m && m.isMeshStandardMaterial) {
            m.roughness = hint.roughness;
            m.metalness = hint.metalness;
            m.needsUpdate = true;
          }
        });
      }

      applyPlasticFinish(o); // ก่อน applyProceduralTexture — ใส่ UV/roughnessMap ของตัวเองไว้แล้ว อันหลังจะข้ามไป
      applyProceduralTexture(o, { roughnessMap: getNoiseRoughnessTexture() });
      // ลาย pin-strip เป็นของแทนพินจริง — โมเดลที่มี GPIO_Header_Pins แล้วไม่ต้องใช้ (จะกลายเป็นแถบเงินทับพลาสติก)
      if (o.name === "GPIO_Header" && !root.getObjectByName("GPIO_Header_Pins")) applyProceduralTexture(o, { map: getPinStripTexture(), tintWhite: true });
    });

    const parts = getParts();
    parts.forEach((p, i) => {
      const name3d = PART_NAMES_3D[i] || "PART_" + i;
      const { x, z } = boardToScene(p.x, p.y);
      let mesh = root.getObjectByName(name3d);
      const foundInGltf = !!mesh;

      if (!mesh) {
        console.warn('[board3d] ไม่พบ node ชื่อ "' + name3d + '" ใน board.glb — ใช้ primitive สำรองแทนชิ้นนี้ (ตรวจชื่อ Object ใน Blender ตาม board3d-parts-map.js)');
        if (name3d === "OLED_Screen") {
          mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.038), new THREE.MeshBasicMaterial({ color: 0x225599 }));
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(x, 0.0006, z);
        } else {
          mesh = makePrimitiveMesh(name3d);
          const h = mesh.geometry.parameters.height || 0.01;
          mesh.position.set(x, h / 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
        mesh.name = name3d;
        partGroup.add(mesh);
      }

      if (name3d === "RGB_LED") mesh.traverse((o) => { if (o.material) o.material.toneMapped = false; });
      if (name3d === "OLED_Screen") wireOled(mesh, foundInGltf);

      byName.set(name3d, mesh);
      addPickable(name3d, i);
    });
  }

  function loadModel() {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => { buildFromGLTF(gltf); fitGround(); },
      undefined,
      (err) => {
        console.warn("[board3d] โหลด " + MODEL_URL + " ไม่สำเร็จ — ใช้ primitive geometry (Phase A) แทนทั้งหมด:", err);
        buildPrimitives();
        fitGround();
      }
    );
  }
  loadModel();

  /* ---------------- raycasting: outline highlight + click → showPart(i) เดิม ---------------- */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let hovered = null;

  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    // ยิงใส่ทั้งฉาก แล้วดูแค่สิ่งแรกที่โดน — ถ้าเป็น PCB หรือชิ้นที่บังอยู่ด้านหน้า ก็ไม่ไฮไลต์ชิ้นที่อยู่ด้านหลัง
    // node ใน glTF อาจเป็น Group ที่มี mesh ลูกหลายชิ้น จึงไล่ขึ้นไปหา parent ที่ตรงกับ visualMesh
    const hits = raycaster.intersectObject(scene, true);
    for (let o = hits.length ? hits[0].object : null; o; o = o.parent) {
      const entry = pickables.find((p) => p.visualMesh === o);
      if (entry) return entry;
    }
    return null;
  }

  // ไฮไลต์ชิ้นที่ชี้ด้วยเส้นขอบ (OutlinePass) แทนการขยายสเกล — ไม่ไปแตะ transform ของโมเดล
  // และได้ขอบตาม silhouette จริง ไม่ใช่เส้น edge ทุกเส้นของ mesh (ชิ้นจาก Blender มีรายละเอียดเยอะ)
  // render target ใส่ MSAA (samples) เอง เพราะ antialias ของ renderer ไม่มีผลเมื่อวาดผ่าน composer
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outlinePass.visibleEdgeColor.set(0x4a95ff);
  outlinePass.hiddenEdgeColor.set(0x1d4fb8);
  outlinePass.edgeStrength = 5;
  outlinePass.edgeThickness = 1;
  outlinePass.edgeGlow = 0;
  composer.addPass(outlinePass);
  composer.addPass(new OutputPass()); // tone mapping + sRGB ให้เหมือนตอน render ตรงด้วย renderer

  function setHover(entry) {
    if (hovered === entry) return;
    hovered = entry;
    outlinePass.selectedObjects = hovered ? [hovered.visualMesh] : [];
    canvas.style.cursor = hovered ? "pointer" : "";
    renderOnce();
  }

  function onPointerMove(e) { setHover(pickAt(e.clientX, e.clientY)); }
  function onClick(e) {
    const hit = pickAt(e.clientX, e.clientY);
    if (hit) onSelect(hit.index);
  }
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("click", onClick);

  /* ---------------- resize ---------------- */
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderOnce();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  /* ---------------- render loop ---------------- */
  let running = false;
  let rafId = null;
  function renderOnce() { composer.render(); }
  function loop() {
    if (!running) return;
    controls.update();
    renderOnce();
    emitLabels();
    rafId = requestAnimationFrame(loop);
  }

  // ส่งตำแหน่งบนจอ (px ภายใน canvas) ของแต่ละชิ้นให้ index.html วางป้ายชื่อตามมุมกล้องปัจจุบัน
  // visible=false เมื่อชิ้นอยู่นอกกรอบภาพหรือหลังกล้อง (เช่นตอนซูมเข้าใกล้มาก)
  const labelPos = new THREE.Vector3();
  function emitLabels() {
    if (!onLabels || !pickables.length) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    onLabels(pickables.map((p) => {
      labelPos.copy(p.anchor).project(camera);
      return {
        index: p.index,
        x: ((labelPos.x + 1) / 2) * w,
        y: ((1 - labelPos.y) / 2) * h,
        visible: labelPos.z < 1 && Math.abs(labelPos.x) <= 1 && Math.abs(labelPos.y) <= 1,
      };
    }));
  }

  function show() {
    running = true;
    resize();
    if (rafId == null) loop();
  }
  function hide() {
    running = false;
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ---------------- sync จาก ESP32Sim.snapshot() ---------------- */
  function setEmissive(mesh, hex, on) {
    if (!mesh.material || !mesh.material.emissive) return;
    mesh.material.color.set(on ? hex : 0x2c333b);
    mesh.material.emissive.set(on ? hex : 0x000000);
  }

  // กดปุ่ม = ยุบเฉพาะฝา (<ชื่อ>_Cap) ลงจากตำแหน่งเดิมในโมเดล — ตัวเรือน/แผ่นโลหะ/ขาอยู่กับที่เหมือนสวิตช์จริง
  // (primitive สำรองไม่มี _Cap ก็ยุบทั้งชิ้นแทน) จำตำแหน่งตั้งต้นไว้ แทนการเซ็ตความสูงตายตัวที่ไม่ตรงกับโมเดล
  const BUTTON_TRAVEL = 0.0006;
  function pressButton(name, pressed) {
    const node = byName.get(name);
    if (!node) return;
    const cap = node.getObjectByName(name + "_Cap") || node;
    if (cap.userData.restY === undefined) cap.userData.restY = cap.position.y;
    cap.position.y = cap.userData.restY - (pressed ? BUTTON_TRAVEL : 0);
  }

  function update(s) {
    if (!s) return;

    const rgb = byName.get("RGB_LED");
    if (rgb && rgb.material) {
      const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s.rgbCss);
      if (m) {
        // ค่าจาก rgbCss เป็น sRGB (0–255 แบบ CSS) — ต้องบอก three ว่าเป็น SRGBColorSpace ไม่งั้นจะถูกตีความเป็น
        // linear แล้วสีผสม/PWM จะสว่างและซีดกว่าที่โค้ดสั่ง
        const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255;
        // สีตัวเลนส์ (diffuse) ลดลงเหลือ 25% ให้แสงที่ LED เปล่งเอง (emissive) เป็นหลัก — ถ้า diffuse เต็มด้วย
        // แสงฉากจะบวกเพิ่มจนเกินช่วงแล้ว tone mapping บีบเข้าหาสีขาว สีจะซีดแบบพาสเทล
        rgb.material.color.setRGB(r * 0.25, g * 0.25, b * 0.25, THREE.SRGBColorSpace);
        if (rgb.material.emissive) {
          rgb.material.emissive.setRGB(r, g, b, THREE.SRGBColorSpace);
          rgb.material.emissiveIntensity = r + g + b > 0 ? 1.0 : 0;
        }
      }
    }

    const relay1 = byName.get("RELAY1"); if (relay1) setEmissive(relay1, 0x16a34a, s.relay1);
    const relay2 = byName.get("RELAY2"); if (relay2) setEmissive(relay2, 0x16a34a, s.relay2);

    const buzzer = byName.get("BUZZER");
    if (buzzer) setEmissive(buzzer, 0xf59e0b, s.tone > 0);

    // ปุ่ม A/B ใน 3D เป็นการ "สะท้อนสถานะ" (reflect) เท่านั้น ไม่ใช่ input จริง —
    // อินพุตจริงยังคงมาจากคีย์ลัด A/B หรือปุ่ม 2D เดิม (#hwA/#hwB) ผ่าน ESP32Sim.setBtn()
    pressButton("BTN_A", s.btnA);
    pressButton("BTN_B", s.btnB);

    const pot = byName.get("POT_VR");
    if (pot) pot.rotation.y = -(s.adc / 4095) * Math.PI * 1.5;

    if (oledState.texture) oledState.texture.needsUpdate = true;

    renderOnce(); // วาดทันทีแม้ไม่ได้อยู่ใน render loop เพื่อให้ตรงสถานะล่าสุดเสมอ
  }

  function resetView() {
    camera.position.copy(initialCamPos);
    controls.target.set(0, 0, 0);
    controls.update();
    renderOnce();
  }

  function dispose() {
    hide();
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("click", onClick);
    composer.dispose();
    renderer.dispose();
  }

  setTheme("light");
  return { show, hide, update, resetView, setTheme, dispose };
}
