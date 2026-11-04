import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { PART_NAMES_3D } from "./board3d-parts-map.js";

const BOARD_PX_W = 560, BOARD_PX_H = 500;
const SCALE = 0.14 / BOARD_PX_W;
const BOARD_THICKNESS = 0.0016; 
const MODEL_URL = new URL("./assets/models/board.glb", import.meta.url).href;

function boardToScene(x, y) {
  return { x: (x - BOARD_PX_W / 2) * SCALE, z: (y - BOARD_PX_H / 2) * SCALE };
}

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

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    d[i] = clamp255(d[i] + n);
    d[i + 1] = clamp255(d[i + 1] + n);
    d[i + 2] = clamp255(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);

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
  ctx.fillStyle = "#b0b0b0"; 
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

const PART_MATERIAL_HINTS = {
  RELAY1: { roughness: 0.8, metalness: 0.0 },
  RELAY2: { roughness: 0.8, metalness: 0.0 },
  BUZZER: { roughness: 0.82, metalness: 0.0 }, 
  BTN_A: { roughness: 0.8, metalness: 0.0 },
  BTN_B: { roughness: 0.8, metalness: 0.0 },
  POT_VR: { roughness: 0.7, metalness: 0.0 },
  SHT31_Sensor: { roughness: 0.65, metalness: 0.0 },
  ESP32_Board: { roughness: 0.6, metalness: 0.1 },
  USB_Port: { roughness: 0.3, metalness: 0.6 },
  RST_Button: { roughness: 0.8, metalness: 0.0 },
  GPIO_Header: { roughness: 0.78, metalness: 0.0 }, 
};

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
      h[y * size + x] = a + (b - a) * ty + (Math.random() - 0.5) * 0.25; 
    }
  }
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  const nc = document.createElement("canvas"), rc = document.createElement("canvas");
  nc.width = nc.height = rc.width = rc.height = size;
  const nImg = nc.getContext("2d").createImageData(size, size), rImg = rc.getContext("2d").createImageData(size, size);
  const k = 2.2; 
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      nImg.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      nImg.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      nImg.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      nImg.data[i + 3] = 255;
      const r = clamp255((0.8 + (at(x, y) - 0.5) * 0.18) * 255); 
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

function applyPlasticFinish(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const dark = materials.filter((m) => m && m.isMeshStandardMaterial && !m.map && m.metalness < 0.3 &&
    Math.max(m.color.r, m.color.g, m.color.b) < 0.25);
  if (!dark.length) return;
  ensureBoxUV(mesh.geometry);
  const { normal, rough } = getPlasticTextures();
  dark.forEach((m) => {
    m.roughness = 1.0; 
    m.roughnessMap = rough;
    m.metalness = 0;
    m.normalMap = normal;
    m.normalScale.set(0.35, 0.35);
    m.envMapIntensity = 0.6;
    m.needsUpdate = true;
  });
}

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

export function initBoard3D(canvas, hooks) {
  const { getParts, onSelect, getOledCanvas, onLabels } = hooks;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
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
  controls.maxPolarAngle = Math.PI / 2 - 0.02; 

  scene.add(new THREE.HemisphereLight(0x9fc3ff, 0x11131a, 0.8));

  const dirLight = new THREE.DirectionalLight(0xfff3e0, 2.4);
  dirLight.position.set(0.22, 0.32, 0.18);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.bias = -0.0003;
  dirLight.shadow.normalBias = 0.0015;
  const SH = 0.11; 
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

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.3, depthWrite: false });
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), shadowMat);
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  shadowFloor.renderOrder = 0;
  groundGroup.add(shadowFloor);

  function fitGround() {
    const box = new THREE.Box3();
    scene.children.forEach((o) => { if (o !== groundGroup) box.expandByObject(o); });
    if (!box.isEmpty()) groundGroup.position.y = box.min.y - 0.0003;
  }

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

  const partGroup = new THREE.Group(); 
  scene.add(partGroup);

  const byName = new Map(); 
  const pickables = []; 
  const oledState = { texture: null };

  function addPickable(name3d, index) {
    const visualMesh = byName.get(name3d);
    scene.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(visualMesh);
    const anchor = box.getCenter(new THREE.Vector3());
    anchor.y = box.max.y;
    pickables.push({ visualMesh, index, anchor });
  }

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

  function wireOled(mesh, fromGltf) {
    const oledCanvas = getOledCanvas();
    const tex = oledCanvas ? new THREE.CanvasTexture(oledCanvas) : null;
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
      applyProceduralTexture(pcb, { map: getPCBColorTexture(), roughnessMap: getNoiseRoughnessTexture(), tintWhite: true });
    }

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

      applyPlasticFinish(o); 
      applyProceduralTexture(o, { roughnessMap: getNoiseRoughnessTexture() });
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

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let hovered = null;

  function pickAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(scene, true);
    for (let o = hits.length ? hits[0].object : null; o; o = o.parent) {
      const entry = pickables.find((p) => p.visualMesh === o);
      if (entry) return entry;
    }
    return null;
  }

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const outlinePass = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outlinePass.visibleEdgeColor.set(0x4a95ff);
  outlinePass.hiddenEdgeColor.set(0x1d4fb8);
  outlinePass.edgeStrength = 5;
  outlinePass.edgeThickness = 1;
  outlinePass.edgeGlow = 0;
  composer.addPass(outlinePass);
  composer.addPass(new OutputPass()); 

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

  function setEmissive(mesh, hex, on) {
    if (!mesh.material || !mesh.material.emissive) return;
    mesh.material.color.set(on ? hex : 0x2c333b);
    mesh.material.emissive.set(on ? hex : 0x000000);
  }

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
        const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255;
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

    pressButton("BTN_A", s.btnA);
    pressButton("BTN_B", s.btnB);

    const pot = byName.get("POT_VR");
    if (pot) pot.rotation.y = -(s.adc / 4095) * Math.PI * 1.5;

    if (oledState.texture) oledState.texture.needsUpdate = true;

    renderOnce(); 
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
