# CareerPilot — Design Document

## Overview

CareerPilot is a personal AI agent dashboard that empowers users to take complete control of their job search. It functions as a command center where users upload their resume, configure search parameters, and let the AI agent autonomously scan the web for relevant openings, score them against the user's profile, and execute applications on their behalf.

The visual thesis is **"Autonomous Precision"** — the interface should feel like a high-tech mission control for your career. The aesthetic is rooted in dark, cinematic data-visualization tropes: deep navy backgrounds, glowing neon accents (green for success/active states, amber for warnings), and clean, monospace typography that evokes a terminal or HUD. Every animation and interaction is designed to give the user a sense of powerful, real-time automation happening behind the scenes.

---

## Design Tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| **Deep Space (Base BG)** | `#030712` | Main application background |
| **Navy Surface** | `#0A1128` | Card backgrounds, elevated panels |
| **Navy Border** | `#1E3A8A` | Card borders, dividers, subtle separators |
| **Ice White** | `#F8FAFC` | Primary typography, high-contrast headings |
| **Steel Grey** | `#94A3B8` | Secondary typography, labels, timestamps |
| **Neon Green** | `#10B981` | Success states, active job status, positive metrics |
| **Amber Glow** | `#F59E0B` | Warning states, pending reviews, active pulses |
| **Cyan Accent** | `#06B6D4` | Interactive highlights, agent activity indicators |

### Typography

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **Primary (UI)** | Inter | 400, 500, 600, 700 | Headings, body text, standard UI labels |
| **Data/Metrics** | JetBrains Mono | 400, 500 | Numbers, percentages, code snippets, status logs |

### Spacing & Layout

- **Sidebar**: Fixed `w-16` on desktop, translucent navy background with right border (`#1E3A8A`).
- **Content Padding**: `px-8 py-6` for the main scrollable area.
- **Cards**: `rounded-xl`, `border border-[#1E3A8A]`, `bg-[#0A1128]`, with a subtle radial gradient glow emanating from the center.
- **Transitions**: Global `transition-all duration-300 ease-out`.

---

## Dependencies

- three
- gsap

---

## Page: Main Dashboard (`/`)

### 1. Top Navigation Bar
A full-width, sticky header bar.
- **Left**: "CareerPilot" wordmark (Inter 700) next to a pulsing green dot indicating "Agent Online".
- **Right**: A single prominent "Initiate Search" pill button (`bg-[#10B981]`, `text-black`, `font-bold`).
- **Interaction**: When clicked, the button transforms into a stop button, and the background begins a slow, subtle green scanline sweep.

### 2. Agent Status HUD (Hero Section)
A large, multi-part card sitting at the top of the dashboard.
- **Left Column**: Houses the **Orbiting Particles Engine** (`OrbitingParticles`) as the main visual anchor. Represents the AI agent actively scanning the digital space.
- **Right Column**: 
  - **Live Metrics**: Four real-time updating stats displayed in JetBrains Mono ("Jobs Scanned", "Match Score Avg", "API Calls", "Success Rate %").
  - **Activity Log**: A scrolling window with a dark inset background, showing live-typed text updates (e.g., "Scanning LinkedIn...", "Parsing resume keywords...", "High match found at TechCorp").

### 3. Analytics Grid
A 3-column grid of data visualization cards.
- **Card 1 (Market Heatmap)**: Houses the **WebGL Heatmap Carousel** (`WebGLHeatmapCarousel`). Visualizes job market density across different sectors (e.g., Frontend, Backend, AI/ML).
- **Card 2 (Application Funnel)**: Houses the **Success Funnel Chart** (`SuccessFunnelChart`). A vertical SVG chart showing the conversion from Scanned -> Matched -> Applied.
- **Card 3 (Daily Targets)**: A circular progress ring (JetBrains Mono) tracking daily application goals against actuals.

### 4. Matched Jobs Table
A full-width, highly styled data table.
- **Headers**: Role, Company, Match %, Salary, Status, Action.
- **Rows**: Alternating subtle navy backgrounds. Each row has a hover effect that slides a "Review & Apply" button into view from the right.
- **Special Effect**: When a new job is added to the table by the agent, the row flashes with a brief green highlight (`#10B981` at 20% opacity).

---

## Global Interactions

- **Loading State**: The initial page load is masked by a full-screen overlay featuring the Orbiting Particles Engine centered, with the text "INITIALIZING AGENT" below it. Fades out after 1.5s.
- **Notifications**: Success events (e.g., "Application Submitted") trigger a toast notification sliding down from the top right with a green accent border.

---

## Core Effects

### WebGL Heatmap Carousel

**Description:** A fullscreen WebGL shader effect mapped inside a card container. It displays a 3D carousel of image panels that continuously rotate on a cylindrical path. As the user hovers over the card, the panels drift and react to the cursor position. The entire scene is overlaid with a procedural heatmap visualization and a depth-of-field blur that intensifies at the edges.

**Implementation Details:**
This effect relies entirely on the fragment shader. The JavaScript/TypeScript setup simply provides a fullscreen quad and passes time, resolution, and mouse coordinates.

**Shader Code (Fragment Shader):**
Implement a fragment shader with `precision highp float;`, uniforms `u_time`, `u_res`, `u_speed`, `u_glowIntensity`, and `u_mouse`, plus varying `v_uv`. It must contain these helpers exactly:

1. `hash(vec2 p)` returns `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)`.
2. `noise(vec2 p)`:
   - Compute `i = floor(p)` and `f = fract(p)`.
   - Smooth `f` with `f = f * f * (3.0 - 2.0 * f)`.
   - Bilinearly mix the four corner hashes in this exact order: `hash(i)`, `hash(i + vec2(1.0, 0.0))`, `hash(i + vec2(0.0, 1.0))`, `hash(i + vec2(1.0, 1.0))`, first across `f.x`, then across `f.y`.
3. `fbm(vec2 p)` starts from `f = 0.0` and `a = 0.5`, then runs `for (int i = 0; i < 5; i++)`, each iteration adding `a * noise(p)` and then updating `p = p * 2.0 + vec2(1.7, 3.2)` and `a *= 0.5`.
4. `rot(float a)` computes `c = cos(a)` and `s = sin(a)` and returns `mat2(c, -s, s, c)`.
5. `heatmapColor(float t)` remaps `t` through a 5-stop palette in this exact order:
   - `vec3(0.0, 0.0, 0.2)` for `t < 0.2`
   - `vec3(0.0, 0.0, 0.6)` for `t < 0.4`
   - `vec3(0.0, 0.6, 0.8)` for `t < 0.6`
   - `vec3(0.8, 0.8, 0.0)` for `t < 0.8`
   - otherwise `vec3(1.0, 0.0, 0.0)`
6. `imagePanel(vec2 uv, float panelIndex, float numPanels, float carouselRadius, float carouselAngle, vec2 panelSize)`:
   - Start with `pi = 3.14159265` and `angleStep = 2.0 * pi / numPanels`.
   - Compute `panelAngle = carouselAngle + panelIndex * angleStep`.
   - Compute the panel center as `pc = vec2(carouselRadius * cos(panelAngle), carouselRadius * sin(panelAngle))`.
   - Rotate the local UV with `luv = rot(-panelAngle - pi / 2.0) * (uv - pc)`.
   - Only if `abs(luv.x) < panelSize.x / 2.0 && abs(luv.y) < panelSize.y / 2.0`, compute:
     - `px = (luv.x + panelSize.x / 2.0) / panelSize.x`
     - `py = (luv.y + panelSize.y / 2.0) / panelSize.y`
     - `imgCoord = vec2(px, py)`
     - `n1 = fbm(imgCoord * 3.0 + panelIndex * 10.0)`
     - `n2 = fbm(imgCoord * 8.0 - panelIndex * 5.0 + u_time * 0.1)`
     - `distortedCoord = imgCoord + vec2(n1, n2) * 0.05`
     - `checker = mod(floor(distortedCoord.x * 6.0) + floor(distortedCoord.y * 4.0), 2.0)`
     - `intensity = mix(0.2, 0.8, checker)`
     - `heatT = intensity * 0.7 + 0.2 * sin(u_time * 0.5 + panelIndex)`
     - `col = heatmapColor(heatT)`
     - `depth = sin(panelAngle - carouselAngle) * 0.5 + 0.5`
     - `col *= 0.6 + 0.4 * depth`
     - Return `vec4(col, 1.0)`.
   - Otherwise return `vec4(0.0)`.

In `main()`, perform the rendering in this exact order:

1. Normalize fragment coordinates with `uv = (gl_FragCoord.xy - 0.5 * u_res.xy) / u_res.y`.
2. Compute animation state as `t = u_time * u_speed`.
3. Set `mouseOffset = vec2(0.0)`; if `u_mouse.x >= 0.0`, convert the mouse to the same coordinate space with `(u_mouse - 0.5 * u_res.xy) / u_res.y` and multiply by `0.5`.
4. Start `col` as `vec3(0.02, 0.03, 0.05)` and set `carouselRadius = 0.35`.
5. Compute `carouselAngle = t * 0.3 + mouseOffset.x`.
6. Set `numPanels = 6.0` and `panelSize = vec2(0.35, 0.5)`.
7. Draw panels in back-to-front order with `for (int i = 5; i >= 0; i--)`, adding each returned panel color to `col` using `mix(col, panel.rgb, panel.a)` when `panel.a > 0.0`.
8. Add heatmap overlay intensity `ho` as `fbm(uv * 2.0 + t * 0.05) * 0.5 + 0.5`, multiply by `u_glowIntensity`, and add `heatmapColor(ho) * 0.15` to `col`.
9. Add ambient particles by looping `for (int i = 0; i < 20; i++)`:
   - `fi = float(i)`
   - `pa = fi / 20.0 * 6.28318`
   - `pr = 0.05 + 0.3 * fract(sin(fi * 17.0) * 43758.5)`
   - `ps = 0.3 + 0.2 * sin(fi * 3.0)`
   - `pp = vec2(pr * cos(pa + t * ps), pr * sin(pa + t * ps) * 0.6)`
   - `pd = length(uv - pp)`
   - Add `(1.0 - smoothstep(0.0, 0.02, pd)) * 0.3 * u_glowIntensity` to `col`.
10. Compute depth-of-field as `dof = smoothstep(0.3, 0.9, length(uv * vec2(0.8, 1.0)))` and blend toward `col * 0.6`.
11. Add vignette with `vig = 1.0 - smoothstep(0.5, 1.2, length(uv * vec2(0.8, 1.0)))` and multiply `col` by `0.7 + 0.3 * vig`.
12. Add film grain with `(fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453) - 0.5) * 0.02`.
13. Apply the tone-map/gamma step `col = pow(col / (1.0 + col * 0.2), vec3(0.9))`.
14. Output `gl_FragColor = vec4(col, 1.0)`.

**Wiring Code (TypeScript/React):**
Create `HeatmapCarousel()` that returns `{ containerRef, init, dispose }` and tracks mutable `state` with these fields exactly: `container: HTMLElement | null`, `renderer: WebGLRenderer | null`, `scene: Scene | null`, `camera: OrthographicCamera | null`, `material: ShaderMaterial | null`, `animationId: number | null`, `isDisposed: boolean`, and `isPaused: boolean`.

Implement the helpers exactly like this:

- `init(container: HTMLElement)`:
  1. If `state.renderer` already exists, return immediately.
  2. Set `state.container = container`.
  3. Create `scene = new THREE.Scene()`.
  4. Create `camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)`.
  5. Create a `ShaderMaterial` with `vertexShader` `varying vec2 v_uv; void main() { v_uv = uv; gl_Position = vec4(position, 1.0); }` and the fragment shader above.
  6. Set the initial uniforms exactly to:
     - `u_time: { value: 0.0 }`
     - `u_res: { value: new THREE.Vector2(1, 1) }`
     - `u_speed: { value: 0.5 }`
     - `u_glowIntensity: { value: 1.2 }`
     - `u_mouse: { value: new THREE.Vector2(-1, -1) }`
  7. Create `mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)`.
  8. Add the mesh to the scene.
  9. Create `renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })`.
  10. Call `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`.
  11. Append `renderer.domElement` to the container.
  12. Store `scene`, `camera`, `material`, and `renderer` on `state`.
  13. Add `handleResize` on `window`, which must:
      - compute `w = container.clientWidth` and `h = container.clientHeight`
      - call `renderer.setSize(w, h)`
      - set `material.uniforms.u_res.value.set(w, h)`
      - only then call `renderer.render(scene, camera)`
  14. Invoke `handleResize()` once immediately.
  15. Add a `handleMouseMove` listener on the container; it must call `getBoundingClientRect()` on the container, then set `u_mouse` to:
      - `x = (e.clientX - rect.left) * (w / rect.width)`
      - `y = (h - (e.clientY - rect.top) * (h / rect.height))`
  16. Start the render loop with `animate()`.

- `animate()`:
  1. If `state.isDisposed` is true, return.
  2. Set `state.animationId = requestAnimationFrame(animate)`.
  3. Only if `!state.isPaused && state.material && state.renderer && state.scene && state.camera`, update `state.material.uniforms.u_time.value += 0.016` and then call `state.renderer.render(state.scene, state.camera)`.

- `dispose()`:
  1. Set `state.isDisposed = true`.
  2. If `state.animationId` exists, cancel it.
  3. Remove the `resize` and `mousemove` listeners.
  4. If `state.material` exists, dispose it.
  5. If `state.renderer` exists, call `renderer.dispose()`, then `renderer.domElement.parentElement?.removeChild(renderer.domElement)`.
  6. Reset `state.renderer`, `state.scene`, `state.camera`, and `state.material` to `null`.

`containerRef` is the React callback ref used to mount the WebGL canvas.

---

### Orbiting Particles Engine

**Description:** A deep, 3D particle simulation that visualizes data nodes orbiting a central core. Used in the Agent Status HUD to represent active scanning. Particles leave a trailing wake behind them as they orbit on tilted, concentric rings.

**Implementation Details:**
Requires Three.js and a custom `MeshLine` library for the trails.

**Core JavaScript/Three.js Setup:**
Import `* as THREE from 'three'`, `gsap`, and `{ MeshLine, MeshLineMaterial } from 'meshline'`. Initialize the renderer with `alpha: true`, `antialias: true`, and `powerPreference: "high-performance"`. Use a `PerspectiveCamera(50, width / height, 1, 1000)` positioned at `(0, 0, 2)`. All scene colors are `#0A1128`.

Core classes:

- `AnimatedMeshLine` extends `THREE.Mesh`
  - The constructor takes `{ width = 0.03, speed = 0.01, visibleLength = 0.5, color = new THREE.Color('#10B981') } = {}` plus extra `geometry` parameters.
  - Inside the constructor:
    1. Compute `linePoints = []` and `currentPoint = new THREE.Vector3()`.
    2. Loop `i` from `0` through `50` inclusive.
    3. On each iteration, push `currentPoint.clone()` into `linePoints`.
    4. Then update `currentPoint` with:
       - `x += (Math.random() * 1.2 - 0.6) * 1.5`
       - `y += (Math.random() * 1.2 - 0.6) * 1.5`
       - `z += (Math.random() * 1.2 - 0.6) * 1.5`
  5. Pass that `linePoints` array to `new MeshLine()` via `line.setPoints(linePoints)`.
  6. Create `MeshLineMaterial` with `lineWidth: width`, `dashArray: 2`, `dashOffset: 0`, `dashRatio: 1 - (visibleLength * 0.5)`, `opacity: 1`, `transparent: true`, `depthWrite: false`, and `color`.
  7. Call `super(line.geometry, material)`.
  8. Store:
     - `this.speed = speed`
     - `this.dashLength = dashArray - (dashArray * dashRatio)`
     - `this.dyingAt = 1`
     - `this.diedAt = this.dyingAt + this.dashLength`
  - `update()` must increment `this.material.uniforms.dashOffset.value -= this.speed` and return `this.material.uniforms.dashOffset.value < this.diedAt`.

- `Lines` extends `THREE.Object3D`
  - It has mutable fields `lines: AnimatedMeshLine[] = []` and `lineStatic: THREE.Mesh`.
  - `addLine()` creates `line = new AnimatedMeshLine(...)` with randomized dash-state values, then pushes it to `this.lines` and adds it to the object.
  - `update()` loops backward through `this.lines` with `i--`, calls `isDied = this.lines[i].update()`, and if `isDied` is true, removes that line from both the object and the `lines` array.

The `CustomSystem` uses:
- A `THREE.Group()` named `system`
- A `new THREE.SphereGeometry(0.8, 32, 32)` named `radius`
- `trails = new Lines()` added to `system`
- 400 instanced orbiting particles, each a `THREE.Mesh(new THREE.SphereGeometry(1, 6, 6), new THREE.MeshBasicMaterial({ color: 0x10B981 }))` scaled to `0.01`

Particle initialization:
- Allocate `dummy = new THREE.Object3D()` and `axis = new THREE.Vector3()`.
- Loop `i` from `0` to `400`:
  1. Pick `pos` from `radius.vertices[Math.floor(Math.random() * radius.vertices.length)]`.
  2. Create an orbiting particle object with this exact shape:
     - `position: new THREE.Vector3(pos.x, pos.y, pos.z)`
     - `中心点: new THREE.Vector3()`
     - `中心向量: new THREE.Vector3().subVectors(new THREE.Vector3(), p.position).normalize()`
     - `轴线: new THREE.Vector3(...)` where each component is `Math.random() - 0.5`
     - `旋转速度: Math.random() * 2.0 + 1`
     - `半径: p.position.distanceTo(p.中心点)`
     - `translate: new THREE.Matrix4().makeTranslation(p.半径, 0, 0)`
     - `速度: Math.random() * 1.2 + 0.5`
     - `速度方向: Math.random() > 0.5 ? 1 : -1`
     - `最大角度: Math.random() * (Math.PI / 1.2)`
  3. On each frame, compute `当前角度 = (elapsedTime * p.速度 * p.速度方向) % p.最大角度`.
  4. Build `rotate = new THREE.Matrix4().makeRotationAxis(p.轴线, 当前角度)`.
  5. Compute `position = p.position.clone().applyMatrix4(rotate)`.
  6. Set `dummy.position` to `position`, call `dummy.updateMatrix()`, and write it into the instanced mesh with `instancedMesh.setMatrixAt(i, dummy.matrix)`.
  7. Trail spawning must run exactly as follows:
     - only if `Math.random() < 0.2`
     - compute `dist = position.distanceTo(p.中心点)`
     - if `dist < p.半径 - 0.05 || dist > p.半径 + 0.05`, return immediately for this particle
     - otherwise push one new trail data object into `trails.linePoints` with `width: 0.01`, `speed: 0.015`, `visibleLength: 0.7`, and `color: new THREE.Color('#10B981')`
- After the loop, mark `instancedMesh.instanceMatrix.needsUpdate = true`.

---

### Success Funnel Chart

**Description:** A vertical SVG funnel mapping the stages of the job application pipeline. It uses GSAP morphing to smoothly transition the width of SVG paths, and floating particles drift upward through the funnel's opening.

**HTML/SVG Structure:**
Use a wrapper `<div class="relative w-64 h-96 mx-auto">`. Inside it, place an `<svg>` with `viewBox="0 0 200 400"` and `class="absolute inset-0 w-full h-full drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"`.

Define these gradients in `<defs>` exactly:
- `<linearGradient id="funnel-grad" x1="0" y1="0" x2="0" y2="1">`
  - `<stop offset="0%" stop-color="#1E3A8A"/>`
  - `<stop offset="100%" stop-color="#10B981"/>`
- `<linearGradient id="beam-grad" x1="0" y1="0" x2="0" y2="1">`
  - `<stop offset="0%" stop-color="#10B981" stop-opacity="0"/>`
  - `<stop offset="50%" stop-color="#10B981" stop-opacity="0.6"/>`
  - `<stop offset="100%" stop-color="#10B981" stop-opacity="0"/>`

Draw the funnel in this exact layer order:
1. `<path d="M 50 20 L 150 20 L 140 100 L 60 100 Z" fill="url(#funnel-grad)"/>`
2. `<path d="M 60 100 L 140 100 L 120 200 L 80 200 Z" fill="url(#funnel-grad)" opacity="0.85"/>`
3. `<path d="M 80 200 L 120 200 L 105 300 L 95 300 Z" fill="url(#funnel-grad)" opacity="0.7"/>`
4. `<path d="M 95 300 L 105 300 L 100 380 Z" fill="#10B981"/>`

Then add a particle container `<div id="particles-stage" class="absolute inset-0 pointer-events-none"></div>` on top.

**GSAP Timeline Logic:**
Import `gsap` from `gsap` and `SplitText` from `gsap/SplitText`, then register the plugin with `gsap.registerPlugin(SplitText)`.

- `animateEntry(tl: gsap.core.Timeline)` must:
  1. Set `const parts = ['#funnel-1', '#funnel-2', '#funnel-3']`.
  2. Call `tl.set(parts, { transformOrigin: 'center top', scaleY: 0, opacity: 0 })`.
  3. Stagger them in with `tl.to(parts, { scaleY: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.2)', stagger: 0.2 })`.
  4. Animate `#funnel-4` separately with `tl.from('#funnel-4', { scale: 0, transformOrigin: 'center top', duration: 0.6, ease: 'back.out(1.5)' }, '-=0.4')`.

- `animateBeam()` must query `#beam-path` and run a repeating tween on it with:
  - `duration: 1.5`
  - `opacity: { value: 0.3, duration: 0.75, yoyo: true, repeat: 1 }`
  - `ease: 'sine.inOut'`
  - `repeat: -1`

- `addParticles(container: HTMLElement)` must:
  1. Loop `for (let i = 0; i < 15; i++)`.
  2. Create a `<div class="absolute w-1 h-1 bg-[#10B981] rounded-full"/>`.
  3. Assign it a random initial X with `left: 20 + Math.random() * 60%`.
  4. Append it to `container`.
  5. Tween it with:
     - `y: -400`
     - `duration: 3 + Math.random() * 2`
     - `repeat: -1`
     - `ease: 'none'`
     - `delay: Math.random() * 3`
     - `opacity: { value: 0, duration: 2, delay: 1 }`

---

## Assets

- **Fonts**: Inter (Google Fonts), JetBrains Mono (Google Fonts).
- **Images**: 
  - `generate_image`: "A glowing green wireframe globe representing the internet, floating in a dark navy void, digital data streams, cinematic lighting, 16:9 aspect ratio."
  - `generate_image`: "Abstract flowing data ribbons in neon green and deep blue, representing job market streams, high contrast, dark background."

---

## Notes

- **Strategy**: `dark-first`
- **Interaction Mapping**:
  - `Top Button` triggers: 
    1. Page background scanline.
    2. Agent Status HUD text updates.
    3. Orbiting Particles Engine `speed` multiplier increases from `1` to `4`.
    4. Matched Jobs Table rows begin populating with staggered CSS animations.
- **Heatmap Resilience**: The WebGL Heatmap Carousel must be wrapped in a container that detects if WebGL context is lost. If lost, gracefully fallback to a CSS `background-color: #0A1128` container with a subtle radial gradient.
- **Funnel Integration**: The `addParticles` function must attach DOM nodes directly to the `#particles-stage` div overlaying the SVG to ensure they drift correctly over the graphic without getting clipped by the SVG viewbox.