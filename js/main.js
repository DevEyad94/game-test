import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import GPUHelper from './gpu-helper.js';
import CONFIG from './config.js';

// Check for force GPU setting in localStorage
const forceGPU = localStorage.getItem('force-gpu') === 'true';
if (forceGPU) {
    console.log('Force GPU rendering is enabled');
    GPUHelper.forceGPURendering();
    GPUHelper.addGPUStyles();
} else {
    // Still add styles for better performance
    GPUHelper.addGPUStyles();
}

// Constants
const WORLD_SIZE = parseInt(localStorage.getItem('world-size')) || CONFIG.WORLD_SIZE;
const CHUNK_SIZE = CONFIG.CHUNK_SIZE;
const BLOCK_SIZE = CONFIG.BLOCK_SIZE;
const GRAVITY = CONFIG.GRAVITY;
const JUMP_FORCE = parseFloat(localStorage.getItem('jump-height')) || CONFIG.JUMP_FORCE;
const MOVEMENT_SPEED = CONFIG.MOVEMENT_SPEED;
const RENDER_DISTANCE = parseInt(localStorage.getItem('render-distance')) || CONFIG.RENDER_DISTANCE;

// Game state
const state = {
    blocks: new Map(), // Map to store blocks using position string as key
    visibleBlocks: new Map(), // Map to store only visible blocks
    selectedBlockType: 'grass',
    playerVelocity: new THREE.Vector3(0, 0, 0),
    playerOnGround: false,
    keysPressed: {}, // Tracks pressed keys
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    inventory: ['grass', 'dirt', 'stone', 'wood', 'leaves'],
    selectedInventoryIndex: 0,
    isJumping: false,
};

// Setup scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150);
camera.position.set(WORLD_SIZE * CHUNK_SIZE / 2, 30, WORLD_SIZE * CHUNK_SIZE / 2);

// Load saved graphics quality or use default
const graphicsQuality = localStorage.getItem('graphics-quality') || 'low';

// Configure renderer based on graphics quality
const rendererSettings = {
    antialias: graphicsQuality === 'high',
    powerPreference: "high-performance", // Always request high-performance GPU
    precision: CONFIG.PRECISION,
    alpha: false, // Disable alpha for better performance
    stencil: false, // Disable stencil buffer for better performance
    depth: true, // Keep depth testing enabled
    failIfMajorPerformanceCaveat: false, // Don't fail if hardware acceleration isn't available
    premultipliedAlpha: true // Better performance with transparency
};

const renderer = new THREE.WebGLRenderer(rendererSettings);

// Set size and pixel ratio based on quality
renderer.setSize(window.innerWidth, window.innerHeight);
const maxPixelRatio = graphicsQuality === 'high' ? 2.0 : (graphicsQuality === 'medium' ? 1.5 : 1.0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));

// Configure shadows based on quality
renderer.shadowMap.enabled = graphicsQuality === 'high';
if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

// Apply extra optimizations to the renderer
renderer.sortObjects = false; // Disable sorting for better performance
renderer.physicallyCorrectLights = false; // Disable for better performance

// Add renderer to DOM
document.getElementById('game-container').appendChild(renderer.domElement);

// Textures
const textureLoader = new THREE.TextureLoader();
const textures = {
    grass: {
        top: textureLoader.load('textures/grass_top.jpg'),
        side: textureLoader.load('textures/grass_side.jpg'),
        bottom: textureLoader.load('textures/dirt.jpg'),
    },
    dirt: {
        all: textureLoader.load('textures/dirt.jpg'),
    },
    stone: {
        all: textureLoader.load('textures/stone.jpg'),
    },
    wood: {
        top: textureLoader.load('textures/wood_top.jpg'),
        side: textureLoader.load('textures/wood_side.jpg'),
    },
    leaves: {
        all: textureLoader.load('textures/leaves.jpg'),
    },
};

// Configure textures
Object.values(textures).forEach(group => {
    Object.values(group).forEach(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.magFilter = THREE.NearestFilter; // Minecraft-like pixelated look
        texture.minFilter = THREE.NearestFilter;
        
        // GPU optimizations
        texture.generateMipmaps = false; // Disable mipmaps for better performance
        texture.anisotropy = graphicsQuality === 'high' ? 4 : 1; // Anisotropic filtering
    });
});

// Create materials for each block type with GPU optimizations
function createMaterial(map, transparent = false) {
    return new THREE.MeshLambertMaterial({ 
        map: map,
        transparent: transparent,
        alphaTest: transparent ? 0.5 : 0,
        flatShading: true, // Use flat shading for better performance
        wireframe: false,
        vertexColors: false,
        fog: false, // Disable fog for better performance
        dithering: false // Disable dithering for better performance
    });
}

const materials = {
    grass: [
        createMaterial(textures.grass.side), // right
        createMaterial(textures.grass.side), // left
        createMaterial(textures.grass.top), // top
        createMaterial(textures.grass.bottom), // bottom
        createMaterial(textures.grass.side), // front
        createMaterial(textures.grass.side), // back
    ],
    dirt: Array(6).fill(createMaterial(textures.dirt.all)),
    stone: Array(6).fill(createMaterial(textures.stone.all)),
    wood: [
        createMaterial(textures.wood.side), // right
        createMaterial(textures.wood.side), // left
        createMaterial(textures.wood.top), // top
        createMaterial(textures.wood.top), // bottom
        createMaterial(textures.wood.side), // front
        createMaterial(textures.wood.side), // back
    ],
    leaves: Array(6).fill(createMaterial(textures.leaves.all, true)),
};

// Create common block geometry
const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

// Controls setup
const controls = new PointerLockControls(camera, document.body);

// Make controls accessible to the settings panel
window.controls = controls;

// Click anywhere to lock/unlock controls
document.addEventListener('click', () => {
    if (!controls.isLocked) {
        controls.lock();
    }
});

controls.addEventListener('lock', () => {
    console.log('Controls locked');
    document.body.style.cursor = 'none';
});

controls.addEventListener('unlock', () => {
    console.log('Controls unlocked');
    document.body.style.cursor = 'auto';
});

// Add controls to scene
scene.add(controls.getObject());

// Lighting
const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6); // Increased ambient light intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(-1, 1, 0.5).normalize();

// Setup shadows if high-quality graphics are enabled
if (graphicsQuality === 'high') {
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.bias = -0.001;
    
    // Optimize shadow camera frustum
    const shadowSize = RENDER_DISTANCE / 2;
    directionalLight.shadow.camera.left = -shadowSize;
    directionalLight.shadow.camera.right = shadowSize;
    directionalLight.shadow.camera.top = shadowSize;
    directionalLight.shadow.camera.bottom = -shadowSize;
}

scene.add(directionalLight);

// Simple sky color
scene.background = new THREE.Color(0x87CEEB); // Light blue sky color

// Helper Functions
function getBlockKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function isBlockAt(x, y, z) {
    return state.blocks.has(getBlockKey(x, y, z));
}

function addBlock(x, y, z, type) {
    if (isBlockAt(x, y, z)) return; // Block already exists

    const key = getBlockKey(x, y, z);
    const position = new THREE.Vector3(x, y, z);
    const block = new THREE.Mesh(blockGeometry, materials[type]);
    block.position.copy(position);
    block.position.addScalar(0.5); // Center the block
    block.userData = { type, coordinates: { x, y, z } };
    
    // Store block in the map but don't add to scene yet
    state.blocks.set(key, block);
    
    // If within render distance, add to visible blocks
    updateBlockVisibility(block, key);
}

function removeBlock(x, y, z) {
    const key = getBlockKey(x, y, z);
    if (!state.blocks.has(key)) return;
    
    const block = state.blocks.get(key);
    
    // Remove from scene if it's visible
    if (state.visibleBlocks.has(key)) {
        scene.remove(block);
        state.visibleBlocks.delete(key);
    }
    
    state.blocks.delete(key);
}

// New function to update block visibility based on player position
function updateVisibleBlocks() {
    const playerPos = controls.getObject().position;
    
    // First, hide blocks that are now too far
    for (const [key, block] of state.visibleBlocks.entries()) {
        const { x, y, z } = block.userData.coordinates;
        const dx = x - playerPos.x;
        const dy = y - playerPos.y;
        const dz = z - playerPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq > RENDER_DISTANCE * RENDER_DISTANCE) {
            scene.remove(block);
            state.visibleBlocks.delete(key);
        }
    }
    
    // Then, show blocks that are now close enough
    // For performance, only check blocks that might be in range
    const checkRange = Math.ceil(RENDER_DISTANCE / BLOCK_SIZE);
    const minX = Math.floor(playerPos.x) - checkRange;
    const maxX = Math.floor(playerPos.x) + checkRange;
    const minY = Math.floor(playerPos.y) - checkRange;
    const maxY = Math.floor(playerPos.y) + checkRange;
    const minZ = Math.floor(playerPos.z) - checkRange;
    const maxZ = Math.floor(playerPos.z) + checkRange;
    
    // Limit to world boundaries
    const worldX = WORLD_SIZE * CHUNK_SIZE;
    const worldZ = WORLD_SIZE * CHUNK_SIZE;
    
    for (let x = Math.max(0, minX); x <= Math.min(worldX - 1, maxX); x++) {
        for (let z = Math.max(0, minZ); z <= Math.min(worldZ - 1, maxZ); z++) {
            // Only check reasonable Y levels - from bottom of world to a bit above player
            for (let y = Math.max(0, minY); y <= Math.min(100, maxY); y++) {
                const key = getBlockKey(x, y, z);
                const block = state.blocks.get(key);
                
                if (block && !state.visibleBlocks.has(key)) {
                    updateBlockVisibility(block, key);
                }
            }
        }
    }
}

function updateBlockVisibility(block, key) {
    const playerPos = controls.getObject().position;
    const { x, y, z } = block.userData.coordinates;
    const dx = x - playerPos.x;
    const dy = y - playerPos.y;
    const dz = z - playerPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    
    if (distSq <= RENDER_DISTANCE * RENDER_DISTANCE) {
        // If not already visible, add to scene
        if (!state.visibleBlocks.has(key)) {
            scene.add(block);
            state.visibleBlocks.set(key, block);
        }
    }
}

// World Generation
function generateTerrain() {
    console.time('Terrain Generation');
    // Simple flat terrain with some hills
    for (let x = 0; x < WORLD_SIZE * CHUNK_SIZE; x++) {
        for (let z = 0; z < WORLD_SIZE * CHUNK_SIZE; z++) {
            // Calculate terrain height with simplex noise (here simplified)
            const height = Math.floor(
                Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 + 
                Math.sin(x * 0.05) * Math.cos(z * 0.05) * 4 + 15
            );
            
            // Add grass at the top
            addBlock(x, height, z, 'grass');
            
            // Add dirt below grass
            for (let y = height - 1; y > height - 4; y--) {
                addBlock(x, y, z, 'dirt');
            }
            
            // Add stone below dirt
            for (let y = height - 4; y > 0; y--) {
                addBlock(x, y, z, 'stone');
            }
        }
    }
    
    // Add some trees
    const numTrees = 10; // Reduced from 20 to 10
    for (let i = 0; i < numTrees; i++) {
        const x = Math.floor(Math.random() * WORLD_SIZE * CHUNK_SIZE);
        const z = Math.floor(Math.random() * WORLD_SIZE * CHUNK_SIZE);
        const y = findHighestBlock(x, z) + 1;
        
        generateTree(x, y, z);
    }
    console.timeEnd('Terrain Generation');
    
    // Force initial visibility update
    updateVisibleBlocks();
}

function findHighestBlock(x, z) {
    for (let y = 100; y >= 0; y--) {
        if (isBlockAt(x, y, z)) {
            return y;
        }
    }
    return 0;
}

function generateTree(x, y, z) {
    // Trunk - simpler with fixed height
    const trunkHeight = 4;
    for (let tY = 0; tY < trunkHeight; tY++) {
        addBlock(x, y + tY, z, 'wood');
    }
    
    // Leaves - simplified cubic shape
    const leafStart = y + trunkHeight - 1;
    
    // Create a 3x3x3 cube of leaves
    for (let lY = 0; lY < 3; lY++) {
        for (let lX = -1; lX <= 1; lX++) {
            for (let lZ = -1; lZ <= 1; lZ++) {
                // Skip if it would replace the trunk
                if (lX === 0 && lZ === 0 && lY < 2) continue;
                
                addBlock(x + lX, leafStart + lY, z + lZ, 'leaves');
            }
        }
    }
}

// Collision detection
function checkCollision(position) {
    // Check collision with blocks around the player
    const playerSize = { width: 0.6, height: 1.8, depth: 0.6 };
    const margin = 0.1; // Small margin to avoid floating point issues
    
    // Check for blocks at these offsets from the player's position
    const offsets = [
        // Bottom collisions (feet) - check multiple points for smoother landing
        { x: 0, y: -playerSize.height / 2 - margin, z: 0 },
        { x: playerSize.width / 3, y: -playerSize.height / 2 - margin, z: 0 },
        { x: -playerSize.width / 3, y: -playerSize.height / 2 - margin, z: 0 },
        { x: 0, y: -playerSize.height / 2 - margin, z: playerSize.depth / 3 },
        { x: 0, y: -playerSize.height / 2 - margin, z: -playerSize.depth / 3 },
        
        // Top collisions (head)
        { x: 0, y: playerSize.height / 2 + margin, z: 0 },
        
        // Side collisions (body)
        { x: playerSize.width / 2 + margin, y: 0, z: 0 },
        { x: -playerSize.width / 2 - margin, y: 0, z: 0 },
        { x: 0, y: 0, z: playerSize.depth / 2 + margin },
        { x: 0, y: 0, z: -playerSize.depth / 2 - margin },
        
        // Additional side points to prevent getting stuck in corners
        { x: playerSize.width / 2 + margin, y: 0, z: playerSize.depth / 2 + margin },
        { x: -playerSize.width / 2 - margin, y: 0, z: playerSize.depth / 2 + margin },
        { x: playerSize.width / 2 + margin, y: 0, z: -playerSize.depth / 2 - margin },
        { x: -playerSize.width / 2 - margin, y: 0, z: -playerSize.depth / 2 - margin },
    ];
    
    const collisions = {
        top: false,
        bottom: false,
        left: false,
        right: false,
        front: false,
        back: false
    };
    
    for (const offset of offsets) {
        const testX = position.x + offset.x;
        const testY = position.y + offset.y;
        const testZ = position.z + offset.z;
        
        if (isBlockAt(testX, testY, testZ)) {
            if (offset.y < 0) collisions.bottom = true;
            if (offset.y > 0) collisions.top = true;
            if (offset.x > 0) collisions.right = true;
            if (offset.x < 0) collisions.left = true;
            if (offset.z > 0) collisions.front = true;
            if (offset.z < 0) collisions.back = true;
        }
    }
    
    return collisions;
}

// Block interaction
function placeBlock() {
    if (!controls.isLocked) return;
    
    state.raycaster.setFromCamera(state.mouse, camera);
    
    // Filter objects to only include visible blocks
    const intersects = state.raycaster.intersectObjects(
        Array.from(state.visibleBlocks.values())
    );
    
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const normal = intersection.face.normal.clone();
        const position = intersection.point.clone().add(normal.multiplyScalar(0.5));
        
        // Get block coordinates (floored to ensure they're on grid)
        const x = Math.floor(position.x);
        const y = Math.floor(position.y);
        const z = Math.floor(position.z);
        
        // Check if placement won't intersect with player
        const playerPos = controls.getObject().position;
        const dx = Math.abs(playerPos.x - (x + 0.5));
        const dy = Math.abs(playerPos.y - (y + 0.5));
        const dz = Math.abs(playerPos.z - (z + 0.5));
        
        if (!(dx < 0.8 && dy < 1.8 && dz < 0.8)) {
            addBlock(x, y, z, state.selectedBlockType);
        }
    }
}

function breakBlock() {
    if (!controls.isLocked) return;
    
    state.raycaster.setFromCamera(state.mouse, camera);
    
    // Filter objects to only include visible blocks
    const intersects = state.raycaster.intersectObjects(
        Array.from(state.visibleBlocks.values())
    );
    
    if (intersects.length > 0) {
        const intersection = intersects[0];
        const block = intersection.object;
        const { x, y, z } = block.userData.coordinates;
        
        removeBlock(x, y, z);
    }
}

// Keyboard shortcut for settings panel (Escape key)
function toggleSettingsPanel() {
    const settingsPanel = document.getElementById('settings-panel');
    if (settingsPanel) {
        const isVisible = settingsPanel.style.display === 'block';
        settingsPanel.style.display = isVisible ? 'none' : 'block';
        
        // If opening settings, unlock controls
        if (!isVisible) {
            controls.unlock();
        }
    }
}

// Controls
function handleKeyDown(event) {
    state.keysPressed[event.code] = true;
    
    // Handle inventory selection
    if (event.code.startsWith('Digit')) {
        const digit = parseInt(event.code.substring(5)) - 1;
        if (digit >= 0 && digit < state.inventory.length) {
            state.selectedInventoryIndex = digit;
            state.selectedBlockType = state.inventory[digit];
            
            // Update UI
            document.querySelectorAll('.inventory-slot').forEach((slot, index) => {
                if (index === digit) {
                    slot.classList.add('selected');
                } else {
                    slot.classList.remove('selected');
                }
            });
        }
    }
    
    // Toggle settings with Tab key
    if (event.code === 'Tab') {
        event.preventDefault(); // Prevent default tab behavior
        toggleSettingsPanel();
    }
    
    // Hide controls hint after any key press
    if (event.code === 'KeyW' || event.code === 'KeyA' || 
        event.code === 'KeyS' || event.code === 'KeyD' || 
        event.code === 'Space') {
        const controlsHint = document.getElementById('controls-hint');
        if (controlsHint) {
            controlsHint.style.display = 'none';
        }
    }
    
    // Toggle controls hint with H key
    if (event.code === 'KeyH') {
        const controlsHint = document.getElementById('controls-hint');
        if (controlsHint) {
            controlsHint.style.display = controlsHint.style.display === 'none' ? 'flex' : 'none';
        }
    }
}

function handleKeyUp(event) {
    state.keysPressed[event.code] = false;
}

function handleMouseClick(event) {
    if (!controls.isLocked) return;
    
    if (event.button === 0) { // Left click
        breakBlock();
    } else if (event.button === 2) { // Right click
        placeBlock();
    }
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
document.addEventListener('mousedown', handleMouseClick);
document.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu
document.addEventListener('mousemove', (e) => {
    // Update mouse position for raycaster (centered at 0,0)
    state.mouse.x = 0;
    state.mouse.y = 0;
});

// Movement and physics
function updatePlayer(deltaTime) {
    if (!controls.isLocked) return;
    
    const playerObject = controls.getObject();
    
    // Apply gravity
    if (!state.playerOnGround) {
        state.playerVelocity.y -= GRAVITY * deltaTime;
        
        // Cap falling speed to prevent falling through blocks at high speeds
        if (state.playerVelocity.y < -0.8) {
            state.playerVelocity.y = -0.8;
        }
    }
    
    // Get movement direction from keys
    const moveDirection = new THREE.Vector3(0, 0, 0);
    
    if (state.keysPressed['KeyW']) moveDirection.z -= 1; // Forward
    if (state.keysPressed['KeyS']) moveDirection.z += 1; // Backward
    if (state.keysPressed['KeyA']) moveDirection.x += 1; // Right (was Left, now reversed)
    if (state.keysPressed['KeyD']) moveDirection.x -= 1; // Left (was Right, now reversed)
    
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        
        // Adjust movement direction based on camera orientation
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        const cameraRight = new THREE.Vector3().crossVectors(
            new THREE.Vector3(0, 1, 0), cameraDirection
        ).normalize();
        
        // Build movement vector from camera's forward and right vectors
        const adjustedDirection = new THREE.Vector3();
        adjustedDirection.addScaledVector(cameraDirection, -moveDirection.z); // Forward/backward
        adjustedDirection.addScaledVector(cameraRight, moveDirection.x);     // Left/right
        
        if (adjustedDirection.length() > 0) {
            adjustedDirection.normalize();
            
            // Apply movement with speed
            // Slow down a bit in the air for better control
            const speedMultiplier = state.playerOnGround ? 1.0 : 0.8;
            state.playerVelocity.x = adjustedDirection.x * MOVEMENT_SPEED * speedMultiplier;
            state.playerVelocity.z = adjustedDirection.z * MOVEMENT_SPEED * speedMultiplier;
        }
    } else {
        // Friction when not moving
        state.playerVelocity.x = 0;
        state.playerVelocity.z = 0;
    }
    
    // Handle jumping
    if (state.keysPressed['Space']) {
        if (state.playerOnGround && !state.isJumping) {
            state.playerVelocity.y = JUMP_FORCE;
            state.playerOnGround = false;
            state.isJumping = true; // Prevent double-jumping by holding space
        }
    } else {
        state.isJumping = false; // Reset jump flag when space key is released
    }
    
    // Calculate new position
    const newPosition = playerObject.position.clone();
    newPosition.x += state.playerVelocity.x * deltaTime * 60;
    newPosition.y += state.playerVelocity.y * deltaTime * 60;
    newPosition.z += state.playerVelocity.z * deltaTime * 60;
    
    // Check collisions
    const collisions = checkCollision(newPosition);
    
    // Apply velocity with collision response
    if (!collisions.right && !collisions.left) {
        playerObject.position.x += state.playerVelocity.x * deltaTime * 60;
    } else {
        state.playerVelocity.x = 0; // Stop horizontal movement when hitting a wall
    }
    
    if (!collisions.top && !collisions.bottom) {
        playerObject.position.y += state.playerVelocity.y * deltaTime * 60;
    } else {
        state.playerVelocity.y = 0;
        
        if (collisions.bottom) {
            state.playerOnGround = true;
        }
    }
    
    if (!collisions.front && !collisions.back) {
        playerObject.position.z += state.playerVelocity.z * deltaTime * 60;
    } else {
        state.playerVelocity.z = 0; // Stop forward/backward movement when hitting a wall
    }
    
    // Ensure player doesn't fall through the world
    if (playerObject.position.y < -10) {
        const centerX = Math.floor(WORLD_SIZE * CHUNK_SIZE / 2);
        const centerZ = Math.floor(WORLD_SIZE * CHUNK_SIZE / 2);
        const resetY = findHighestBlock(centerX, centerZ) + 3;
        playerObject.position.set(centerX, resetY, centerZ);
        state.playerVelocity.set(0, 0, 0);
    }
}

// Animation Loop
let lastTime = 0;
let visibilityUpdateTimer = 0;
let frameCount = 0;
let fpsTime = 0;
let fps = 0;

// Update GPU status detection after renderer initialization
function checkGPUStatus() {
    // Get detailed GPU info
    const gpuInfo = GPUHelper.getGPUInfo();
    const isGPU = gpuInfo.isGPU || GPUHelper.detectGPU();
    
    // Display GPU info in console
    console.log('GPU Info:', gpuInfo);
    
    // Basic info for UI display
    let displayInfo = "Unknown";
    let emoji = "❓";
    
    if (gpuInfo.supported) {
        // Extract the GPU name - try to get just the model name
        let gpuName = gpuInfo.rendererUnmasked || gpuInfo.renderer || "Unknown";
        
        // Try to simplify the name by extracting the important parts
        const simplifiedName = simplifyGPUName(gpuName);
        
        // Set the emoji based on detection
        emoji = isGPU ? "✅" : "❌";
        
        // Format the display string
        displayInfo = `${emoji} ${simplifiedName}`;
        
        // Color based on whether it's a real GPU
        const color = isGPU ? '#8eff8e' : '#ff8e8e';
        
        // Update the UI
        const gpuStatus = document.getElementById('gpu-status');
        if (gpuStatus) {
            gpuStatus.textContent = `GPU: ${displayInfo}`;
            gpuStatus.style.color = color;
            
            // Add title with full info for hover
            gpuStatus.title = `Vendor: ${gpuInfo.vendorUnmasked || gpuInfo.vendor}\nRenderer: ${gpuInfo.rendererUnmasked || gpuInfo.renderer}`;
            
            // Add click handler to show more details
            gpuStatus.style.cursor = 'pointer';
            gpuStatus.addEventListener('click', () => {
                alert(`GPU Details:\n\nVendor: ${gpuInfo.vendorUnmasked || gpuInfo.vendor}\nRenderer: ${gpuInfo.rendererUnmasked || gpuInfo.renderer}\nUsing Hardware Acceleration: ${isGPU ? 'Yes' : 'No'}\nMax Texture Size: ${gpuInfo.maxTextureSize}`);
            });
        }
        
        // Show warning if software rendering is detected
        if (!isGPU && !forceGPU) {
            const gpuRendererName = gpuInfo.rendererUnmasked || gpuInfo.renderer || '';
            const isSoftwareRenderer = 
                gpuRendererName.toLowerCase().includes('swiftshader') || 
                gpuRendererName.toLowerCase().includes('software') ||
                gpuRendererName.toLowerCase().includes('llvmpipe');
                
            if (isSoftwareRenderer) {
                showGPUWarning();
            }
        }
    } else {
        // No WebGL support
        document.getElementById('gpu-status').textContent = 'GPU: ❌ Not Available';
        document.getElementById('gpu-status').style.color = '#ff8e8e';
    }
}

// Function to show GPU warning
function showGPUWarning() {
    const gpuWarning = document.getElementById('gpu-warning');
    if (gpuWarning) {
        gpuWarning.style.display = 'block';
        
        // Add event listener to close button
        const closeButton = document.getElementById('close-gpu-warning');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                gpuWarning.style.display = 'none';
            });
        }
        
        // Add event listener to enable GPU button
        const enableGPUButton = document.getElementById('enable-gpu');
        if (enableGPUButton) {
            enableGPUButton.addEventListener('click', () => {
                // Enable GPU acceleration
                localStorage.setItem('force-gpu', 'true');
                
                // Update settings dropdown if it exists
                const forceGPUSelect = document.getElementById('force-gpu');
                if (forceGPUSelect) {
                    forceGPUSelect.value = 'force';
                }
                
                // Apply GPU acceleration now
                GPUHelper.forceGPURendering();
                
                // Close the warning
                gpuWarning.style.display = 'none';
                
                // Show confirmation message
                alert('GPU acceleration has been enabled. The game will now attempt to use your graphics card for better performance.');
                
                // Suggest reloading for best effect
                if (confirm('For best results, the page should be reloaded. Would you like to reload now?')) {
                    location.reload();
                }
            });
        }
    }
}

// Simplify GPU name for display
function simplifyGPUName(fullName) {
    // No name available
    if (!fullName || fullName === "Unknown") return "Unknown GPU";
    
    // Convert to lowercase for easier matching
    const lowerName = fullName.toLowerCase();
    
    // Extract the relevant part based on common GPU naming patterns
    if (lowerName.includes('nvidia') || lowerName.includes('geforce')) {
        // For NVIDIA GPUs, try to extract the model number (GTX/RTX + numbers)
        const match = fullName.match(/(RTX|GTX|GT)\s*\d+/i);
        return match ? match[0].toUpperCase() : "NVIDIA";
    } 
    else if (lowerName.includes('amd') || lowerName.includes('radeon')) {
        // For AMD GPUs
        const match = fullName.match(/(Radeon|RX|HD|R9|R7|R5)\s*\d+/i);
        return match ? match[0] : "AMD";
    }
    else if (lowerName.includes('intel')) {
        // For Intel GPUs
        const match = fullName.match(/(HD|UHD|Iris)\s*(Graphics)?\s*\d+/i);
        return match ? match[0] : "Intel";
    }
    else if (lowerName.includes('apple')) {
        return "Apple GPU";
    }
    
    // If we can't identify it specifically, return first two words
    const words = fullName.split(' ');
    return words.length > 1 ? `${words[0]} ${words[1]}` : fullName;
}

// Check GPU status after setup
checkGPUStatus();

// Update performance info in the animation loop
function animate(time) {
    requestAnimationFrame(animate);
    
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;
    
    // Skip frame if deltaTime is too large (e.g., tab was inactive)
    if (deltaTime > 0.2) return;
    
    // FPS calculation
    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= 1.0) {
        fps = Math.round(frameCount / fpsTime);
        document.getElementById('fps-counter').textContent = `FPS: ${fps}`;
        
        // Add performance indicators
        const performanceLevel = fps > 50 ? 'excellent' : (fps > 30 ? 'good' : 'poor');
        document.getElementById('fps-counter').style.color = 
            fps > 50 ? '#8eff8e' : (fps > 30 ? '#ffff8e' : '#ff8e8e');
            
        frameCount = 0;
        fpsTime = 0;
    }
    
    // Only run game logic if controls are locked
    if (controls.isLocked) {
        // Update player physics
        updatePlayer(deltaTime);
        
        // Update visible blocks every 0.5 seconds
        visibilityUpdateTimer += deltaTime;
        if (visibilityUpdateTimer >= 0.5) {
            updateVisibleBlocks();
            visibilityUpdateTimer = 0;
        }
        
        // Render
        renderer.render(scene, camera);
    }
}

// Window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
generateTerrain();

// Position player above the highest block at the center of the map
const centerX = Math.floor(WORLD_SIZE * CHUNK_SIZE / 2);
const centerZ = Math.floor(WORLD_SIZE * CHUNK_SIZE / 2);
const startY = findHighestBlock(centerX, centerZ) + 3; // Place player 3 blocks above ground
camera.position.set(centerX, startY, centerZ);

animate(0);

// Debug helper to locate player position
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
        const pos = controls.getObject().position;
        console.log(`Player position: x=${Math.floor(pos.x)}, y=${Math.floor(pos.y)}, z=${Math.floor(pos.z)}`);
    }
}); 