// Game Configuration
const CONFIG = {
    // World Generation
    WORLD_SIZE: 8,       // World size in chunks
    CHUNK_SIZE: 16,      // Chunk size
    BLOCK_SIZE: 1,       // Block size
    
    // Performance
    RENDER_DISTANCE: 20, // Render distance (lower = better performance)
    ANTIALIASING: false, // Enable antialiasing (false = better performance)
    SHADOWS: false,      // Enable shadows (false = better performance)
    MAX_PIXEL_RATIO: 1.0,// Maximum pixel ratio (lower = better performance)
    USE_GPU: true,       // Use GPU acceleration
    PRECISION: 'lowp',// WebGL precision (lowp, mediump, highp)
    
    // Physics
    GRAVITY: 0.08,       // Gravity force
    JUMP_FORCE: 0.1,     // Jump force (reduced from 0.5 to 0.3)
    MOVEMENT_SPEED: 0.15,// Player movement speed
    
    // World Features
    TREE_COUNT: 10,      // Number of trees to generate
};

export default CONFIG; 