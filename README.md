# ESP32 Board Simulator

A browser-based simulator for an ESP32 dev board. Write Arduino-style
(`.ino`) code in the built-in editor and run it against a simulated board —
no physical hardware or Arduino IDE required.

- Custom C/C++-like lexer/parser/interpreter that mimics `arduino-cli`
  compile output and errors
- 2D (SVG) and 3D (Three.js) board views kept in sync with the running
  simulation
- Serial Monitor (adjustable baud rate, timestamps, autoscroll, send)
- WiFi Router tab, onboard sensors (SHT31, potentiometer, buttons, relays,
  buzzer, RGB LED, OLED)
- Example sketches, open/save `.ino` files, light/dark theme, state
  persisted in `localStorage`

## Running locally

No build step — it's static HTML/JS. Serve the folder with any static
file server, e.g.:

```bash
npx serve .
```

Then open the printed local URL in a browser.

## Running with Docker

```bash
docker compose up --build
```

Open [http://localhost:8080](http://localhost:8080).

## Project structure

- [index.html](index.html) — UI markup, styles, and app wiring
- [sim-engine.js](sim-engine.js) — the sketch compiler/interpreter and
  simulated hardware model
- [board3d.js](board3d.js) — Three.js 3D board view
- [board3d-parts-map.js](board3d-parts-map.js) — maps 3D model node names
  to simulated board parts
- [support.js](support.js) — syntax highlighting / editor support
- [assets/](assets) — board textures and the 3D model (`board.glb`,
  `board-source.blend`)
- [3D-SIMULATOR-PLAN.md](3D-SIMULATOR-PLAN.md) — design notes for the 3D
  view and its phased rollout
