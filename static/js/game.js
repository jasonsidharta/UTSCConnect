// ============================================
// UTSC Connect - 3D Multiplayer Browser Game
// ============================================

// socket is created in index.html before all scripts

// --- Game State ---
let scene, camera, renderer;
let myId = null;
let myPlayer = null;
let otherPlayers = {};    // {id: {mesh, label, data}}
let keys = {};
let chatOpen = false;
let pointerLocked = false;
let yaw = 0, pitch = 0;
let velocity = { x: 0, y: 0, z: 0 };
let isOnGround = true;
let gameStarted = false;

const MOVE_SPEED = 12;
const JUMP_FORCE = 10;
const GRAVITY = -25;
const EYE_HEIGHT = 2.6;
const PLAYER_HEIGHT = 1.0;
const MAP_SIZE = 200;

// Collision walls — array of {minX, maxX, minZ, maxZ} AABBs
const collisionWalls = [];
const PLAYER_RADIUS = 0.4;

// --- Character Selection (used in Uconnect screen) ---
let selectedCharacter = "0";

document.querySelectorAll(".char-option").forEach(opt => {
    opt.addEventListener("click", () => {
        document.querySelectorAll(".char-option").forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
        selectedCharacter = opt.dataset.char;
    });
});

let charactersLoaded = false;

// Called from auth.js when user clicks "Enter World"
function startGame(username, character) {
    const name = username || "Player";
    const char = character || selectedCharacter;
    document.getElementById("game-hud").style.display = "block";
    document.getElementById("pointer-lock-msg").style.display = "block";
    gameStarted = true;
    socket.emit("set_username", { username: name, character: char });
    initGame();
}

// --- Three.js Setup ---
function initGame() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 80, 200);

    // Camera — first-person at eye level (start on a road, not inside the fountain)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, EYE_HEIGHT, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0; // allow canvas to receive keyboard focus
    document.body.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x4a7c59,
        roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper for orientation
    const grid = new THREE.GridHelper(MAP_SIZE * 2, 40, 0x3d6b4a, 0x3d6b4a);
    grid.position.y = 0.01;
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    scene.add(grid);

    // Generate the town (wrapped in try-catch so rendering still works if it fails)
    try {
        generateTown();
    } catch (e) {
        console.error("Town generation failed:", e);
        // Show error on screen for debugging
        const errDiv = document.createElement("div");
        errDiv.style.cssText = "position:fixed;top:50px;left:50%;transform:translateX(-50%);background:red;color:white;padding:10px 20px;z-index:999;font-size:16px;border-radius:8px";
        errDiv.textContent = "Map error: " + e.message;
        document.body.appendChild(errDiv);
    }

    // Events
    setupControls();
    window.addEventListener("resize", onResize);

    // Set initial position from server data
    if (myPlayer) {
        camera.position.set(myPlayer.x, EYE_HEIGHT, myPlayer.z);
        yaw = myPlayer.ry || 0;
    }

    // Preload character models, then spawn any queued players
    preloadCharacters(() => {
        if (pendingInit) {
            spawnExistingPlayers(pendingInit);
            pendingInit = null;
        }
        // Spawn any players who joined while scene was loading
        for (const p of pendingJoins) {
            if (p.id === myId || otherPlayers[p.id]) continue;
            const obj = createPlayerMesh(p);
            otherPlayers[p.id] = {
                ...obj,
                targetPos: { x: p.x, y: p.y - 0.1, z: p.z },
                targetRy: p.ry || 0,
                data: p,
            };
        }
        pendingJoins = [];
        updatePlayerCount();
    });

    // Request mic permission early for proximity voice (non-blocking)
    if (typeof initProximityMic === "function") {
        initProximityMic();
    }

    // Debug display
    const debugDiv = document.createElement("div");
    debugDiv.style.cssText = "position:fixed;top:50px;left:10px;color:lime;font-size:14px;font-family:monospace;z-index:999;background:rgba(0,0,0,0.7);padding:8px 12px;border-radius:6px;pointer-events:none";
    document.body.appendChild(debugDiv);

    // Game loop
    let lastTime = performance.now();
    function gameLoop(now) {
        requestAnimationFrame(gameLoop);
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        update(dt);
        renderer.render(scene, camera);

        // Update debug info
        debugDiv.textContent =
            `Locked: ${pointerLocked} | Chat: ${chatOpen} | Player: ${!!myPlayer}\n` +
            `Keys: W=${!!keys["w"]} A=${!!keys["a"]} S=${!!keys["s"]} D=${!!keys["d"]}\n` +
            `Pos: ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`;
    }
    requestAnimationFrame(gameLoop);

    // Send position updates at 20 fps
    setInterval(sendPosition, 50);
}

// ===========================================
// MODEL LOADING SYSTEM + 4 BUILDING SLOTS
// ===========================================

const loader = new THREE.GLTFLoader();

// Building + asset slots
const BUILDING_SLOTS = [
    // Kenney city buildings
    { name: "Skyscraper A", file: "/static/models/building1.glb", x:  40, z:  40, scale: 18, rotY: 0 },
    { name: "Skyscraper C", file: "/static/models/building2.glb", x: -40, z:  40, scale: 18, rotY: Math.PI / 2 },
    { name: "Building A",   file: "/static/models/building3.glb", x: -40, z: -40, scale: 20, rotY: Math.PI },
    { name: "Building D",   file: "/static/models/building4.glb", x:  40, z: -40, scale: 20, rotY: -Math.PI / 2 },
    { name: "Building E",   file: "/static/models/building5.glb", x:  80, z:   0, scale: 20, rotY: 0 },
    { name: "Skyscraper D", file: "/static/models/building6.glb", x: -80, z:   0, scale: 18, rotY: Math.PI },
    { name: "Building H",   file: "/static/models/building7.glb", x:   0, z:  80, scale: 20, rotY: Math.PI / 2 },
    { name: "Skyscraper B", file: "/static/models/building8.glb", x:   0, z: -80, scale: 18, rotY: -Math.PI / 2 },
    // City Park — enterable (solid: false)
    { name: "City Park",    file: "/static/models/park.glb",      x:  88, z:  55, scale: 0.8, rotY: 0, solid: false },
];

function generateTown() {
    // Load all models
    for (const slot of BUILDING_SLOTS) {
        loadBuildingModel(slot);
    }
    // Add roads and trees
    generateRoads();
    generateTrees();
}

// --- ROADS ---
function generateRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xdddd44, roughness: 0.8 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });

    const roadW = 6;
    const halfMap = 100;

    // Main roads — a cross through the center + outer ring
    const hRoads = [-60, 0, 60];  // horizontal roads (along X axis)
    const vRoads = [-60, 0, 60];  // vertical roads (along Z axis)

    for (const z of hRoads) {
        // Road
        const road = new THREE.Mesh(new THREE.BoxGeometry(halfMap * 2, 0.06, roadW), roadMat);
        road.position.set(0, 0.03, z);
        road.receiveShadow = true;
        scene.add(road);
        // Center line
        const line = new THREE.Mesh(new THREE.BoxGeometry(halfMap * 2, 0.02, 0.15), lineMat);
        line.position.set(0, 0.07, z);
        scene.add(line);
        // Sidewalks
        for (const s of [-1, 1]) {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(halfMap * 2, 0.12, 1), sidewalkMat);
            sw.position.set(0, 0.06, z + s * (roadW / 2 + 0.5));
            sw.receiveShadow = true;
            scene.add(sw);
        }
    }

    for (const x of vRoads) {
        const road = new THREE.Mesh(new THREE.BoxGeometry(roadW, 0.06, halfMap * 2), roadMat);
        road.position.set(x, 0.03, 0);
        road.receiveShadow = true;
        scene.add(road);
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, halfMap * 2), lineMat);
        line.position.set(x, 0.07, 0);
        scene.add(line);
        for (const s of [-1, 1]) {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, halfMap * 2), sidewalkMat);
            sw.position.set(x + s * (roadW / 2 + 0.5), 0.06, 0);
            sw.receiveShadow = true;
            scene.add(sw);
        }
    }

    // Road leading to the park entrance (from road at z=60, going to park at 88,55)
    const parkRoadLen = 30;
    const parkRoad = new THREE.Mesh(new THREE.BoxGeometry(parkRoadLen, 0.06, roadW), roadMat);
    parkRoad.position.set(73, 0.03, 55);
    parkRoad.receiveShadow = true;
    scene.add(parkRoad);
    const parkLine = new THREE.Mesh(new THREE.BoxGeometry(parkRoadLen, 0.02, 0.15), lineMat);
    parkLine.position.set(73, 0.07, 55);
    scene.add(parkLine);
    for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(parkRoadLen, 0.12, 1), sidewalkMat);
        sw.position.set(73, 0.06, 55 + s * (roadW / 2 + 0.5));
        sw.receiveShadow = true;
        scene.add(sw);
    }
}

// --- TREES ---
function generateTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5C3317, roughness: 0.9 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
    const roundMat = new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.8 });

    // Deterministic seed for consistent trees across players
    let s = 42;
    function rand() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }

    // Tree positions — along roads, around buildings, around the park
    const positions = [];

    // Along road edges
    for (const roadZ of [-60, 0, 60]) {
        for (let x = -90; x <= 90; x += 12 + rand() * 8) {
            positions.push({ x: x + (rand() - 0.5) * 3, z: roadZ + (rand() > 0.5 ? 5 : -5), type: rand() > 0.5 ? 'pine' : 'round' });
        }
    }
    for (const roadX of [-60, 0, 60]) {
        for (let z = -90; z <= 90; z += 12 + rand() * 8) {
            positions.push({ x: roadX + (rand() > 0.5 ? 5 : -5), z: z + (rand() - 0.5) * 3, type: rand() > 0.5 ? 'pine' : 'round' });
        }
    }

    // Around the park area (88, 55) — placed outside the park
    for (let i = 0; i < 12; i++) {
        const angle = rand() * Math.PI * 2;
        const r = 22 + rand() * 8;
        positions.push({ x: 88 + Math.cos(angle) * r, z: 55 + Math.sin(angle) * r, type: 'round' });
    }

    // Perimeter trees
    for (let angle = 0; angle < Math.PI * 2; angle += 0.12) {
        const r = 95 + rand() * 10;
        positions.push({
            x: Math.cos(angle) * r + (rand() - 0.5) * 4,
            z: Math.sin(angle) * r + (rand() - 0.5) * 4,
            type: rand() > 0.5 ? 'pine' : 'round'
        });
    }

    // Scatter some in open blocks
    for (let bx = -80; bx <= 80; bx += 30) {
        for (let bz = -80; bz <= 80; bz += 30) {
            if (rand() > 0.5) {
                positions.push({ x: bx + rand() * 10, z: bz + rand() * 10, type: rand() > 0.4 ? 'round' : 'pine' });
            }
        }
    }

    // Filter out trees on roads, park area, or building positions
    const roadW = 6;
    const filteredPositions = positions.filter(t => {
        // Skip trees on horizontal roads (z = -60, 0, 60)
        for (const rz of [-60, 0, 60]) {
            if (Math.abs(t.z - rz) < roadW / 2 + 2) return false;
        }
        // Skip trees on vertical roads (x = -60, 0, 60)
        for (const rx of [-60, 0, 60]) {
            if (Math.abs(t.x - rx) < roadW / 2 + 2) return false;
        }
        // Skip trees on the park road (x=58 to 88, z=55)
        if (t.x > 56 && t.x < 90 && Math.abs(t.z - 55) < roadW / 2 + 2) return false;
        // Skip trees inside the park area (around 88, 55, radius ~15)
        const dx = t.x - 88, dz = t.z - 55;
        if (Math.sqrt(dx * dx + dz * dz) < 18) return false;
        // Skip trees on building positions
        for (const slot of BUILDING_SLOTS) {
            const bdx = t.x - slot.x, bdz = t.z - slot.z;
            if (Math.sqrt(bdx * bdx + bdz * bdz) < 12) return false;
        }
        return true;
    });

    // Create trees as simple meshes
    for (const t of filteredPositions) {
        const scale = 0.7 + rand() * 0.5;
        const group = new THREE.Group();

        // Trunk
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 3 * scale, 6), trunkMat);
        trunk.position.y = 1.5 * scale;
        trunk.castShadow = true;
        group.add(trunk);

        // Canopy
        if (t.type === 'pine') {
            const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.2 * scale, 5 * scale, 6), pineMat);
            canopy.position.y = 5.5 * scale;
            canopy.castShadow = true;
            group.add(canopy);
        } else {
            const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.2 * scale, 8, 6), roundMat);
            canopy.position.y = 5 * scale;
            canopy.castShadow = true;
            group.add(canopy);
        }

        group.position.set(t.x, 0, t.z);
        scene.add(group);

        // Tree trunk collision (small circle approximated as AABB)
        const r = 0.4 * scale;
        collisionWalls.push({ minX: t.x - r, maxX: t.x + r, minZ: t.z - r, maxZ: t.z + r });
    }
}

function loadBuildingModel(slot) {
    loader.load(
        slot.file,
        // Success — model loaded
        (gltf) => {
            const model = gltf.scene;
            model.position.set(slot.x, 0, slot.z);
            model.scale.set(slot.scale, slot.scale, slot.scale);
            model.rotation.y = slot.rotY || 0;

            // Enable shadows on all meshes in the model
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(model);
            console.log(`Loaded: ${slot.name} from ${slot.file}`);

            // Compute bounding box and register as collision wall (unless non-solid)
            if (slot.solid !== false) {
                const box = new THREE.Box3().setFromObject(model);
                collisionWalls.push({
                    minX: box.min.x,
                    maxX: box.max.x,
                    minZ: box.min.z,
                    maxZ: box.max.z,
                });
                console.log(`Collision for ${slot.name}: X[${box.min.x.toFixed(1)},${box.max.x.toFixed(1)}] Z[${box.min.z.toFixed(1)},${box.max.z.toFixed(1)}]`);
            }

            // Add a light inside the building
            const light = new THREE.PointLight(0xFFEECC, 1.0, 30);
            light.position.set(slot.x, 4, slot.z);
            scene.add(light);
        },
        // Progress
        undefined,
        // Error — show placeholder instead
        (err) => {
            console.warn(`Could not load ${slot.file}, using placeholder. Download .glb models and put them in static/models/`);
            createPlaceholder(slot);
        }
    );
}

// Placeholder building shown when .glb file is missing
function createPlaceholder(slot) {
    const group = new THREE.Group();

    // Simple colored building shape so the map isn't empty
    const colors = [0xCC6644, 0x4488AA, 0x66AA44, 0x8866AA];
    const idx = BUILDING_SLOTS.indexOf(slot);
    const color = colors[idx % colors.length];

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 16), mat);
    body.position.y = 5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Roof
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(21, 0.5, 17), roofMat);
    roof.position.y = 10.25;
    roof.castShadow = true;
    group.add(roof);

    // Door opening (dark face on front)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.1), doorMat);
    door.position.set(0, 2, 8.05);
    group.add(door);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({
        color: 0xAADDFF, emissive: 0x6699BB, emissiveIntensity: 0.4,
    });
    for (const wx of [-6, -2, 2, 6]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.1), winMat);
        win.position.set(wx, 6, 8.05);
        group.add(win);
    }

    // Floating label
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FF4444";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${slot.name} — add ${slot.file.split('/').pop()}`, 256, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.SpriteMaterial({ map: tex });
    const label = new THREE.Sprite(labelMat);
    label.position.set(0, 14, 0);
    label.scale.set(16, 2, 1);
    group.add(label);

    // Interior light
    const light = new THREE.PointLight(0xFFEECC, 0.8, 25);
    light.position.set(0, 8, 0);
    group.add(light);

    group.position.set(slot.x, 0, slot.z);
    scene.add(group);

    // Collision for placeholder walls
    const hw = 10, hd = 8;
    collisionWalls.push(
        { minX: slot.x - hw, maxX: slot.x + hw, minZ: slot.z + hd - 0.3, maxZ: slot.z + hd + 0.3 }, // front (with gap check below)
        { minX: slot.x - hw, maxX: slot.x + hw, minZ: slot.z - hd - 0.3, maxZ: slot.z - hd + 0.3 }, // back
        { minX: slot.x - hw - 0.3, maxX: slot.x - hw + 0.3, minZ: slot.z - hd, maxZ: slot.z + hd }, // left
        { minX: slot.x + hw - 0.3, maxX: slot.x + hw + 0.3, minZ: slot.z - hd, maxZ: slot.z + hd }, // right
    );
}

// --- COLLISION DETECTION ---
function checkCollision(newX, newZ) {
    for (const wall of collisionWalls) {
        if (newX + PLAYER_RADIUS > wall.minX &&
            newX - PLAYER_RADIUS < wall.maxX &&
            newZ + PLAYER_RADIUS > wall.minZ &&
            newZ - PLAYER_RADIUS < wall.maxZ) {
            return wall;
        }
    }
    return null;
}

// --- Controls ---
function setupControls() {
    // Force-hide chat input
    const chatInput = document.getElementById("chat-input");
    chatInput.style.display = "none";
    chatInput.style.visibility = "hidden";
    chatInput.blur();

    const lockMsg = document.getElementById("pointer-lock-msg");

    // Pointer lock — ANY click on the page (but NOT when in meeting)
    window.addEventListener("mousedown", (e) => {
        if (!pointerLocked && !chatOpen && gameStarted) {
            // Don't re-lock if meeting overlay is open
            if (typeof inMeeting !== "undefined" && inMeeting) return;
            renderer.domElement.requestPointerLock();
        }
    });

    document.addEventListener("pointerlockchange", () => {
        pointerLocked = document.pointerLockElement === renderer.domElement;
        // Don't show "click to start" if in meeting
        if (typeof inMeeting !== "undefined" && inMeeting) {
            lockMsg.style.display = "none";
        } else {
            lockMsg.style.display = pointerLocked ? "none" : "block";
        }
    });

    // Mouse look
    window.addEventListener("mousemove", (e) => {
        if (!pointerLocked || chatOpen) return;
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch));
    });

    // Keyboard — use window, not document
    window.addEventListener("keydown", (e) => {
        // Ignore events from input fields (login, chat)
        if (e.target.tagName === "INPUT") return;

        const k = e.key.toLowerCase();

        if (chatOpen) {
            if (e.key === "Enter") { toggleChat(); e.preventDefault(); }
            if (e.key === "Escape") { closeChat(); }
            return;
        }

        if (e.key === "Escape" && !chatOpen && !(typeof inMeeting !== "undefined" && inMeeting)) {
            // Quit immediately — no confirm dialog
            document.exitPointerLock();
            gameStarted = false;
            const canvas = document.querySelector("canvas");
            if (canvas) canvas.remove();
            document.getElementById("game-hud").style.display = "none";
            document.getElementById("main-menu").style.display = "flex";
            if (typeof loadLeaderboard === "function") loadLeaderboard();
            return;
        }

        if (e.key === "Enter") { toggleChat(); e.preventDefault(); return; }

        keys[k] = true;

        if (e.key === " " && isOnGround) {
            velocity.y = JUMP_FORCE;
            isOnGround = false;
            e.preventDefault();
        }

        // Press E to enter meeting when in park
        if (k === "e") {
            const meetBtn = document.getElementById("meeting-btn");
            if (meetBtn && meetBtn.style.display !== "none" && typeof joinMeeting === "function") {
                joinMeeting();
            }
        }
    });

    window.addEventListener("keyup", (e) => {
        if (e.target.tagName === "INPUT") return;
        keys[e.key.toLowerCase()] = false;
    });

    // (No combat — peaceful world)
}

// --- Chat ---
function toggleChat() {
    const input = document.getElementById("chat-input");
    if (chatOpen) {
        const msg = input.value.trim();
        if (msg) {
            socket.emit("chat_message", { message: msg });
        }
        input.value = "";
        input.style.display = "none";
        input.style.visibility = "hidden";
        input.blur();
        chatOpen = false;
        renderer.domElement.requestPointerLock();
    } else {
        document.exitPointerLock();
        input.style.display = "block";
        input.style.visibility = "visible";
        input.focus();
        chatOpen = true;
    }
}

function closeChat() {
    const input = document.getElementById("chat-input");
    input.value = "";
    input.style.display = "none";
    input.style.visibility = "hidden";
    input.blur();
    chatOpen = false;
    renderer.domElement.requestPointerLock();
}

function addChatMessage(username, message, color) {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "chat-msg";
    div.innerHTML = `<span class="chat-name" style="color:${color}">${escapeHtml(username)}:</span> ${escapeHtml(message)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    while (container.children.length > 50) {
        container.removeChild(container.firstChild);
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// =============================================
// Movement — CORRECT first-person vector math
// =============================================
//
// In Three.js with Euler order "YXZ":
//   - yaw rotates around Y axis
//   - At yaw = 0, camera looks down -Z
//
// Deriving the forward & right vectors from yaw:
//
//   forward = (-sin(yaw),  0,  -cos(yaw))    ← where camera faces on XZ
//   right   = ( cos(yaw),  0,  -sin(yaw))    ← 90° clockwise from forward
//
// WHY THE OLD CODE WAS WRONG:
//   The old code used a generic 2D rotation matrix:
//     worldX = moveX * cos(yaw) - moveZ * sin(yaw)
//     worldZ = moveX * sin(yaw) + moveZ * cos(yaw)
//
//   This is a standard CCW rotation on a (X, Z) plane where +Z = forward.
//   But in Three.js, +Z points TOWARD the viewer and -Z is forward.
//   So the right vector's Z component was +sin(yaw) instead of -sin(yaw).
//   At yaw = 0 it happened to work (sin(0) = 0), but at any other angle
//   strafing would drift forward/backward instead of being purely sideways.
//
// THE FIX:
//   Explicitly compute forward and right unit vectors, then combine:
//     movement = forward * inputFwd  +  right * inputRight
//
function update(dt) {
    if (!gameStarted || !myPlayer) return;

    // --- Gather WASD input ---
    let inputFwd = 0, inputRight = 0;
    if (!chatOpen) {
        if (keys["w"]) inputFwd   += 1;   // forward (into screen)
        if (keys["s"]) inputFwd   -= 1;   // backward
        if (keys["d"]) inputRight += 1;    // right
        if (keys["a"]) inputRight -= 1;    // left
    }

    // Normalize diagonal so you don't move ~1.41x faster
    const inputLen = Math.sqrt(inputFwd * inputFwd + inputRight * inputRight);
    if (inputLen > 0) {
        inputFwd   /= inputLen;
        inputRight /= inputLen;
    }

    // --- Compute direction vectors from yaw ---
    //   forward = direction camera faces on the XZ plane
    //   right   = 90° clockwise from forward (viewed from above)
    const fwdX   = -Math.sin(yaw);
    const fwdZ   = -Math.cos(yaw);
    const rightX =  Math.cos(yaw);
    const rightZ = -Math.sin(yaw);    // ← THIS was +sin in the old code (the bug)

    // --- Combine into world-space movement ---
    const worldX = fwdX * inputFwd + rightX * inputRight;
    const worldZ = fwdZ * inputFwd + rightZ * inputRight;

    // --- Apply movement with wall collision (slide along walls) ---
    const newX = camera.position.x + worldX * MOVE_SPEED * dt;
    const newZ = camera.position.z + worldZ * MOVE_SPEED * dt;

    // Try full movement first
    if (!checkCollision(newX, newZ)) {
        camera.position.x = newX;
        camera.position.z = newZ;
    } else if (!checkCollision(newX, camera.position.z)) {
        // Slide along X only
        camera.position.x = newX;
    } else if (!checkCollision(camera.position.x, newZ)) {
        // Slide along Z only
        camera.position.z = newZ;
    }
    // else: blocked in both axes, don't move

    // --- Gravity & jump ---
    velocity.y += GRAVITY * dt;
    camera.position.y += velocity.y * dt;

    if (camera.position.y <= EYE_HEIGHT) {
        camera.position.y = EYE_HEIGHT;
        velocity.y = 0;
        isOnGround = true;
    }

    // Clamp to map
    camera.position.x = Math.max(-MAP_SIZE, Math.min(MAP_SIZE, camera.position.x));
    camera.position.z = Math.max(-MAP_SIZE, Math.min(MAP_SIZE, camera.position.z));

    // --- Apply camera rotation (look direction) ---
    const euler = new THREE.Euler(pitch, yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    // --- Sync local player data for networking ---
    myPlayer.x  = camera.position.x;
    myPlayer.y  = camera.position.y - EYE_HEIGHT + PLAYER_HEIGHT;
    myPlayer.z  = camera.position.z;
    myPlayer.ry = yaw;

    // --- Park proximity check for meeting ---
    const parkDx = myPlayer.x - 88;
    const parkDz = myPlayer.z - 55;
    const parkDist = Math.sqrt(parkDx * parkDx + parkDz * parkDz);
    const meetBtn = document.getElementById("meeting-btn");
    const meetOverlay = document.getElementById("meeting-overlay");

    if (parkDist < 18) {
        // In the park — show meeting prompt (if not already in meeting)
        if (meetBtn && meetOverlay.style.display === "none") {
            meetBtn.style.display = "block";
            meetBtn.textContent = "Press E — Enter Meeting";
        }
    } else {
        // Left the park — hide button, auto-leave meeting
        if (meetBtn) meetBtn.style.display = "none";
        if (typeof inMeeting !== "undefined" && inMeeting) {
            leaveMeeting();
        }
    }

    // --- Proximity voice chat (outside park) ---
    if (typeof updateProximityVoice === "function" && parkDist >= 18) {
        updateProximityVoice(myPlayer, otherPlayers);
    }

    // --- Interpolate other players ---
    for (const id in otherPlayers) {
        const op = otherPlayers[id];
        if (op.mesh && op.targetPos) {
            op.mesh.position.x += (op.targetPos.x - op.mesh.position.x) * 0.15;
            op.mesh.position.y += (op.targetPos.y - op.mesh.position.y) * 0.15;
            op.mesh.position.z += (op.targetPos.z - op.mesh.position.z) * 0.15;
            op.mesh.rotation.y += (op.targetRy - op.mesh.rotation.y) * 0.15;

            if (op.label) {
                op.label.position.copy(op.mesh.position);
                op.label.position.y += 2.5;
                op.label.lookAt(camera.position);
            }
        }
    }
}

function sendPosition() {
    if (!myPlayer) return;
    socket.emit("player_move", {
        x: myPlayer.x,
        y: myPlayer.y,
        z: myPlayer.z,
        ry: myPlayer.ry,
    });
}

// --- Player 3D Models ---
let totalCharsInFile = 52; // we know from inspection

function preloadCharacters(callback) {
    // Just mark as ready — each player loads their own fresh GLB
    charactersLoaded = true;
    if (callback) callback();
}

function createPlayerMesh(playerData) {
    const group = new THREE.Group();
    group.position.set(playerData.x, playerData.y - 0.1, playerData.z);
    group.rotation.y = playerData.ry || 0;
    scene.add(group);

    const charIndex = parseInt(playerData.character) || 0;
    addCharacterToGroup(group, charIndex, playerData.color);

    // Name label
    const label = createTextSprite(playerData.username, playerData.color);
    label.position.set(playerData.x, playerData.y + 3.5, playerData.z);
    scene.add(label);

    return { mesh: group, label };
}

// 12 distinct character styles
const CHARACTER_STYLES = [
    { body: 0xe74c3c, legs: 0x922B21, hat: null,     name: "Red" },
    { body: 0x3498db, legs: 0x1A5276, hat: null,     name: "Blue" },
    { body: 0x2ecc71, legs: 0x1E8449, hat: null,     name: "Green" },
    { body: 0x9b59b6, legs: 0x6C3483, hat: null,     name: "Purple" },
    { body: 0xf39c12, legs: 0xB7950B, hat: "top",    name: "Gold" },
    { body: 0x1abc9c, legs: 0x148F77, hat: null,     name: "Teal" },
    { body: 0xe67e22, legs: 0xA04000, hat: "cap",    name: "Orange" },
    { body: 0xe84393, legs: 0xA93275, hat: null,     name: "Pink" },
    { body: 0x2c3e50, legs: 0x1B2631, hat: "top",    name: "Dark" },
    { body: 0xecf0f1, legs: 0xBDC3C7, hat: null,     name: "White" },
    { body: 0xf1c40f, legs: 0xD4AC0D, hat: "cap",    name: "Yellow" },
    { body: 0x00cec9, legs: 0x009688, hat: null,     name: "Cyan" },
];

function addCharacterToGroup(group, charIndex, fallbackColor) {
    const style = CHARACTER_STYLES[charIndex % CHARACTER_STYLES.length];
    const bodyColor = style.body;
    const legColor = style.legs;
    const skinColor = 0xFFDBAC;

    // Head (skin colored)
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), headMat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const ex of [-0.18, 0.18]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
        eye.position.set(ex, 1.75, 0.41);
        group.add(eye);
    }
    // Mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), eyeMat);
    mouth.position.set(0, 1.58, 0.41);
    group.add(mouth);

    // Body (character color)
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.6), bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Arms (skin color)
    const armMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), armMat);
        arm.position.set(side * 0.65, 0.85, 0);
        arm.castShadow = true;
        group.add(arm);
    }

    // Legs (darker color)
    const legMat = new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.6 });
    for (const side of [-0.2, 0.2]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.5), legMat);
        leg.position.set(side, -0.2, 0);
        leg.castShadow = true;
        group.add(leg);
    }

    // Shoes (dark)
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    for (const side of [-0.2, 0.2]) {
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.6), shoeMat);
        shoe.position.set(side, -0.8, 0.05);
        group.add(shoe);
    }

    // Hat (optional based on style)
    if (style.hat === "top") {
        const hatMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
        const brim = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.0), hatMat);
        brim.position.y = 2.14;
        group.add(brim);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), hatMat);
        top.position.y = 2.4;
        group.add(top);
    } else if (style.hat === "cap") {
        const capMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.15, 0.85), capMat);
        cap.position.y = 2.14;
        group.add(cap);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.4), capMat);
        visor.position.set(0, 2.1, 0.45);
        group.add(visor);
    }
}

function createBlockyCharacter(group, color) {
    const bodyMat = new THREE.MeshStandardMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 1), bodyMat);
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), bodyMat);
    head.position.y = 1.25;
    head.castShadow = true;
    group.add(head);

    const armMat = new THREE.MeshStandardMaterial({ color });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.35), armMat);
    leftArm.position.set(-0.675, 0.1, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.35), armMat);
    rightArm.position.set(0.675, 0.1, 0);
    group.add(rightArm);

    const legMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7) });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), legMat);
    leftLeg.position.set(-0.25, -1.4, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), legMat);
    rightLeg.position.set(0.25, -1.4, 0);
    group.add(rightLeg);
}

function createTextSprite(text, color) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 40);
    ctx.fillText(text, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4, 1, 1);
    return sprite;
}

function removePlayerMesh(id) {
    const op = otherPlayers[id];
    if (op) {
        if (op.mesh) scene.remove(op.mesh);
        if (op.label) {
            op.label.material.map.dispose();
            scene.remove(op.label);
        }
        delete otherPlayers[id];
    }
}

function updatePlayerCount() {
    const count = Object.keys(otherPlayers).length + 1;
    document.getElementById("player-count").textContent = `Players: ${count}`;
}

// --- Socket Events ---

// Store init data in case scene isn't ready yet
let pendingInit = null;

socket.on("init", (data) => {
    myId = data.self.id;
    myPlayer = data.self;


    if (camera) {
        camera.position.set(myPlayer.x, EYE_HEIGHT, myPlayer.z);
    }

    // If scene exists, create player meshes now; otherwise queue for later
    if (scene) {
        spawnExistingPlayers(data.players);
    } else {
        pendingInit = data.players;
    }
});

function spawnExistingPlayers(playersData) {
    for (const id in playersData) {
        if (id === myId) continue;
        if (otherPlayers[id]) continue; // already exists
        const p = playersData[id];
        const obj = createPlayerMesh(p);
        otherPlayers[id] = {
            ...obj,
            targetPos: { x: p.x, y: p.y - 0.1, z: p.z },
            targetRy: p.ry || 0,
            data: p,
        };
    }
    updatePlayerCount();
}

// Queue players who join before scene is ready
let pendingJoins = [];

socket.on("player_joined", (p) => {
    if (p.id === myId) return;

    if (!scene) {
        // Queue for later
        pendingJoins.push(p);
        return;
    }

    if (otherPlayers[p.id]) return; // already exists

    const obj = createPlayerMesh(p);
    otherPlayers[p.id] = {
        ...obj,
        targetPos: { x: p.x, y: p.y - 0.1, z: p.z },
        targetRy: p.ry || 0,
        data: p,
    };
    updatePlayerCount();
    addChatMessage("Server", `${p.username} joined the game`, "#95a5a6");
});

socket.on("player_left", (data) => {
    const op = otherPlayers[data.id];
    if (op) {
        addChatMessage("Server", `${op.data.username} left the game`, "#95a5a6");
        removePlayerMesh(data.id);
    }
    updatePlayerCount();
});

socket.on("player_moved", (data) => {
    if (data.id === myId) return;
    const op = otherPlayers[data.id];
    if (op) {
        op.targetPos = { x: data.x, y: data.y - 0.1, z: data.z };
        op.targetRy = data.ry;
        // Update data for proximity voice distance calc
        op.data.x = data.x;
        op.data.y = data.y;
        op.data.z = data.z;
    }
});

socket.on("player_updated", (data) => {
    const op = otherPlayers[data.id];
    if (op) {
        op.data.username = data.username;
        // Update character model if changed
        if (data.character !== undefined && data.character !== op.data.character) {
            op.data.character = data.character;
            while (op.mesh.children.length > 0) {
                op.mesh.remove(op.mesh.children[0]);
            }
            addCharacterToGroup(op.mesh, parseInt(data.character) || 0, op.data.color);
        }
        // Update name label
        if (op.label) {
            op.label.material.map.dispose();
            scene.remove(op.label);
        }
        op.label = createTextSprite(data.username, op.data.color);
        op.label.position.copy(op.mesh.position);
        op.label.position.y += 2.5;
        scene.add(op.label);
    }
});

socket.on("chat_message", (data) => {
    addChatMessage(data.username, data.message, data.color);
});

// Combat removed — this is now a peaceful multiplayer world

// --- Resize ---
function quitUconnect() {
    if (!confirm("Leave the world?")) return;
    document.exitPointerLock();
    gameStarted = false;

    // Remove canvas
    const canvas = document.querySelector("canvas");
    if (canvas) canvas.remove();

    // Hide HUD, show menu
    document.getElementById("game-hud").style.display = "none";
    document.getElementById("main-menu").style.display = "flex";

    // Reload leaderboard
    if (typeof loadLeaderboard === "function") loadLeaderboard();
}

function onResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
