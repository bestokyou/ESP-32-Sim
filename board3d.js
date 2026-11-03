/* board3d.js — ชั้นแสดงผล 3D เสริม (Three.js) บน SPU IoT Board Simulator
 * ตามแผน 3D-SIMULATOR-PLAN.md
 *
 * Phase B: โหลดโมเดลจริงจาก assets/models/board.glb (ปั้นใน Blender ตามตาราง Section 4)
 * ผ่าน GLTFLoader ก่อนเป็นอันดับแรก — ถ้าโหลดไม่สำเร็จ หรือหา node ชื่อที่คาดไว้ไม่เจอ
 * (ไฟล์เสีย/ไม่มีไฟล์/ตั้งชื่อผิดตอน export) จะ log warning แล้ว fallback ไปสร้าง
 * primitive geometry แทนที่ชิ้นส่วนนั้นๆ โดยอัตโนมัติ (Phase A เดิม) — ไม่ทำให้หน้าเว็บพัง
 *
 * ไม่แก้ไข sim-engine.js — อ่านสถานะผ่าน SPUSim.snapshot() ที่ส่งเข้ามาทาง update(s) เท่านั้น
 * ตำแหน่งชิ้นส่วนอ่านจากอาเรย์ PARTS เดิมของ index.html (ส่งเข้ามาผ่าน hooks.getParts())
 * ชื่อ Object 3D มาจาก board3d-parts-map.js (index ต้องตรงกับ PARTS) — ชื่อเดียวกันนี้
 * ต้องตรงกับชื่อ Object ใน Blender เป๊ะๆ (ดูหมายเหตุใน board3d-parts-map.js)
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
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
  RELAY1: { roughness: 0.65, metalness: 0.1 },
  RELAY2: { roughness: 0.65, metalness: 0.1 },
  BUZZER: { roughness: 0.35, metalness: 0.7 },
  BTN_A: { roughness: 0.5, metalness: 0.0 },
  BTN_B: { roughness: 0.5, metalness: 0.0 },
  POT_VR: { roughness: 0.4, metalness: 0.2 },
  SHT31_Sensor: { roughness: 0.5, metalness: 0.0 },
  ESP32_Board: { roughness: 0.45, metalness: 0.35 },
  USB_Port: { roughness: 0.3, metalness: 0.6 },
  RST_Button: { roughness: 0.55, metalness: 0.0 },
  GPIO_Header: { roughness: 0.4, metalness: 0.4 },
};

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
 * @param {{ getParts: () => Array, onSelect: (i:number) => void, getOledCanvas: () => HTMLCanvasElement|null }} hooks
 * @returns {{ show():void, hide():void, update(snapshot):void, resetView():void, dispose():void }}
 */
export function initBoard3D(canvas, hooks) {
  const { getParts, onSelect, getOledCanvas } = hooks;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // ปรับ tone mapping/color space ให้ใกล้เคียงตาจริง — ไม่งั้นภาพจาก MeshStandardMaterial
  // จะดู "จืด" เพราะค่าสีไม่ถูก roll-off โทนสว่าง/มืดแบบกล้องจริง
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12192b);
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

  const partGroup = new THREE.Group(); // ชิ้นส่วน primitive (fallback) + hitbox ทั้งหมด
  scene.add(partGroup);

  const byName = new Map(); // name3d -> visual mesh (จากโมเดลจริงหรือ primitive สำรอง)
  const pickables = []; // { hitbox, visualMesh, index }
  const oledState = { texture: null };

  function addHitbox(name3d, index, x, z) {
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.022, 0.022),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(x, 0.008, z);
    hitbox.name = name3d + "_hitbox";
    partGroup.add(hitbox);
    const visualMesh = byName.get(name3d);
    // เก็บสเกลตั้งต้นไว้ เพราะโมเดลจาก Blender อาจมี object scale ไม่เท่ากับ 1 อยู่แล้ว
    // (เช่นผู้ใช้ปรับขนาดชิ้นส่วนเองใน Blender โดยไม่ได้ Apply Scale ก่อน export)
    // ถ้า hover แล้วเซ็ตสเกลทับเป็นค่าตายตัว จะทำให้ขนาดที่ปรับไว้หายไปตอนเมาส์ออก
    pickables.push({ hitbox, visualMesh, index, baseScale: visualMesh.scale.clone() });
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
      addHitbox(name3d, i, x, z);
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

      applyProceduralTexture(o, { roughnessMap: getNoiseRoughnessTexture() });
      if (o.name === "GPIO_Header") applyProceduralTexture(o, { map: getPinStripTexture(), tintWhite: true });
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
      addHitbox(name3d, i, x, z);
    });
  }

  function loadModel() {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => buildFromGLTF(gltf),
      undefined,
      (err) => {
        console.warn("[board3d] โหลด " + MODEL_URL + " ไม่สำเร็จ — ใช้ primitive geometry (Phase A) แทนทั้งหมด:", err);
        buildPrimitives();
      }
    );
  }
  loadModel();

  /* ---------------- raycasting: hover highlight + click → showPart(i) เดิม ---------------- */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let hovered = null;

  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(pickables.map((p) => p.hitbox), false);
    if (!hits.length) return null;
    return pickables.find((p) => p.hitbox === hits[0].object) || null;
  }

  const HOVER_SCALE = 1.06; // ไฮไลต์แบบขยายเล็กน้อย — ค่าเดิม 1.15 ใหญ่เกินไปจนรู้สึกกระตุก

  function setHover(entry) {
    if (hovered === entry) return;
    // ไม่ขยายจอ OLED ตอน hover เพราะเป็นระนาบแบนขนาดใหญ่ ขยายแล้วลอยเด่นเกินจริง
    // คูณจาก baseScale เดิมเสมอ (ไม่ใช่ setScalar ค่าตายตัว) เพื่อไม่ให้ไปทับขนาดที่ตั้งไว้ใน Blender
    if (hovered && hovered.visualMesh.name !== "OLED_Screen") hovered.visualMesh.scale.copy(hovered.baseScale);
    hovered = entry;
    if (hovered && hovered.visualMesh.name !== "OLED_Screen") hovered.visualMesh.scale.copy(hovered.baseScale).multiplyScalar(HOVER_SCALE);
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderOnce();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  /* ---------------- render loop ---------------- */
  let running = false;
  let rafId = null;
  function renderOnce() { renderer.render(scene, camera); }
  function loop() {
    if (!running) return;
    controls.update();
    renderOnce();
    rafId = requestAnimationFrame(loop);
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

  /* ---------------- sync จาก SPUSim.snapshot() ---------------- */
  function setEmissive(mesh, hex, on) {
    if (!mesh.material || !mesh.material.emissive) return;
    mesh.material.color.set(on ? hex : 0x2c333b);
    mesh.material.emissive.set(on ? hex : 0x000000);
  }

  function update(s) {
    if (!s) return;

    const rgb = byName.get("RGB_LED");
    if (rgb && rgb.material) {
      const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s.rgbCss);
      if (m) {
        const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255;
        rgb.material.color.setRGB(r, g, b);
        if (rgb.material.emissive) {
          rgb.material.emissive.setRGB(r, g, b);
          rgb.material.emissiveIntensity = r + g + b > 0 ? 1.4 : 0;
        }
      }
    }

    const relay1 = byName.get("RELAY1"); if (relay1) setEmissive(relay1, 0x16a34a, s.relay1);
    const relay2 = byName.get("RELAY2"); if (relay2) setEmissive(relay2, 0x16a34a, s.relay2);

    const buzzer = byName.get("BUZZER");
    if (buzzer) setEmissive(buzzer, 0xf59e0b, s.tone > 0);

    // ปุ่ม A/B ใน 3D เป็นการ "สะท้อนสถานะ" (reflect) เท่านั้น ไม่ใช่ input จริง —
    // อินพุตจริงยังคงมาจากคีย์ลัด A/B หรือปุ่ม 2D เดิม (#hwA/#hwB) ผ่าน SPUSim.setBtn()
    const btnA = byName.get("BTN_A"); if (btnA) btnA.position.y = s.btnA ? 0.002 : 0.003;
    const btnB = byName.get("BTN_B"); if (btnB) btnB.position.y = s.btnB ? 0.002 : 0.003;

    const pot = byName.get("POT_VR");
    if (pot) pot.rotation.y = (s.adc / 4095) * Math.PI * 1.5;

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
    renderer.dispose();
  }

  return { show, hide, update, resetView, dispose };
}
