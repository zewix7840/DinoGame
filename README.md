# Dino Run

A lightweight HTML5 Canvas remake of the Chrome Dino runner. Jump and duck to dodge cacti and birds as speed increases—featuring day/night with animated sun & moon, parallax clouds, mobile-first touch controls, and adaptive performance.

## Features
- **Pure HTML/CSS/JS** (no assets, no frameworks).
- **Day/Night cycle** with animated sun/moon; light sprites at night.
- **Keyboard & touch** controls with instant tap response; fast drop on duck.
- **Parallax background** (cloud sway + distant ridges).
- **Adaptive performance** (auto quality scaling by FPS) + manual toggle (🐢/🌀/⚡).
- **Theme chooser** at start (begin Day or Night) + in-game Day/Night toggle (🌓).
- **Local high score** via `localStorage`.
- **Debug hitboxes** (toggle).

## Controls
**Desktop:**  
Space / ↑ — jump • ↓ — duck • **P** — pause • **R** — restart • **M** — mute • **H** — hitboxes • **🌓** — day/night • **⚙️** — quality

**Mobile/Tablet:**  
Tap — jump • Swipe down — duck • (Buttons may be hidden; HUD shows hints)

## Quick Start
1. Download the repo/files.  
2. Open `index.html` in any modern browser.

## Structure
```
index.html   # Canvas + HUD (theme/quality toggles, help text)
styles.css   # Layout, canvas styling, mobile/touch tweaks
script.js    # Game loop, physics, obstacles, visuals, input, FPS adapt
```

- Physics use **delta time** for consistent feel across 60/120/144Hz.
- You can tweak difficulty/feel in `script.js` (e.g., `GRAVITY`, `JUMP_V`, spawn rates).
