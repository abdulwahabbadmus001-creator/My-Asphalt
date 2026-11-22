# My Asphalt

A high-speed, 100% offline procedural 3D arcade racer built with **React**, **TypeScript**, **Three.js**, **Vite**, and the **Web Audio API**. Featuring an 18-car roster across five performance classes, bespoke procedural PBR vehicle silhouettes, dynamic rubber-banding AI, and an adaptive RPM-driven Synthwave soundtrack.

---

## Key Features

- **18-Car Procedural 3D Roster (Classes D, C, B, S & HYPER):** Includes 5 starter vehicles and 13 iconic sports cars, supercars, and hypercars with balanced Power Ratings (PR), stats, and progression across **8 Career Cups**.
- **Signature Procedural PBR Silhouettes:** Rendered with `MeshPhysicalMaterial` clearcoat finishes and custom geometry—including horseshoe and hexagonal grilles, F1 nose cones, V-motion intakes, quad round/X-bar/Y-bar LED taillights, swan-neck and active hydraulic wings, contrasting carbon sideblades, and glass engine bays revealing V8, V10, V12, and W16 plenums.
- **Dynamic Rubber-Banding AI:** Continuously scales AI rival speed, acceleration, and Nitro aggression based on longitudinal gap, player race standing, and overall race progress to keep Career races competitive (leaves human split-screen P2 and WebRTC P2P peers unaffected).
- **Adaptive Procedural Audio & 6 Engine Profiles:**
  - Real-time Web Audio engine synthesizer (`turbo-4`, `muscle-v8`, `wagon-v8`, `v10-howl`, `italian-v12`, `w16-quad-turbo`) with harmonic overtones, redline pitch ceilings, and turbo blow-off chirps.
  - Dynamic Synthwave music sequencer whose BPM and synth layers (percussion, high-RPM arpeggios, and Nitro/Shockwave power chords) intensify with speed, RPM, and boost state.
- **360° Showroom Garage & Safe Save Migration:** Browse and compare all 18 cars using class filter tabs (`ALL`, `D`, `C`, `B`, `S`, `HYPER`), brand/origin badges, and engine tags. Automatic `localStorage` migration preserves cash, trophies, drivers, tools, and upgrades across updates.
- **Game Modes & Controls:** Supports Career Cups, local Split-Screen (P2), WebRTC P2P multiplayer, Ghost Laps, Photo Mode, keyboard controls, and gamepads.

---

## Vehicle Roster Highlights

| Class | Model | Engine Profile |
| :--- | :--- | :--- |
| **Class C** | Ingolstadt RS6 Avant | `wagon-v8` |
| **Class B** | Marinelli F40 Turbo | `turbo-4` / Twin-Turbo |
| **Class B** | Yokohama GT-R Nismo | `turbo-4` / Twin-Turbo |
| **Class B** | Stuttgart 911 GT3 RS | Flat-6 / High-RPM |
| **Class S** | Scuderia SF90 Stradale | `italian-v12` / Hybrid |
| **Class S** | Vorsprung R8 V10 Plus | `v10-howl` |
| **Class S** | Sant'Agata Aventador SVJ | `italian-v12` |
| **HYPER** | Veloce LaRossa V12 | `italian-v12` |
| **HYPER** | Molsheim Chiron Super Sport | `w16-quad-turbo` |
| **HYPER** | Molsheim Bolide Track | `w16-quad-turbo` |
| **HYPER** | Woking P1 GTR | Twin-Turbo V8 Hybrid |
| **HYPER** | Angelholm Jesko Absolut | High-Rev Twin-Turbo |
| **HYPER** | Modena Huayra R | `italian-v12` |

*(Plus 5 foundational starter vehicles spanning Classes D and C.)*

---

## Project Structure

```text
├── public/                         # Static public assets
├── src/
│   ├── App.tsx                     # Root application state & screen routing
│   ├── main.tsx                    # React DOM entry point
│   ├── index.css                   # Global styling
│   ├── components/
│   │   ├── TitleScreen.tsx         # Main menu & mode selection
│   │   ├── GarageScreen.tsx        # 360° showroom, class filters & car dock
│   │   └── CareerScreen.tsx        # 8 Career Cups progression & event selection
│   └── game/
│       ├── types.ts                # Core TypeScript interfaces (cars, physics, saves)
│       ├── catalog.ts              # 18-car roster stats, PR ratings & Career Cups
│       ├── carMesh.ts              # Procedural Three.js PBR body & aero generator
│       ├── sceneManager.ts         # Three.js renderer, lighting, camera & track loop
│       ├── physics.ts              #