# Three.js Minecraft Clone

A high-quality Minecraft-style voxel game built with Three.js, featuring terrain generation, block placement and destruction, player physics, and more.

## Features

- Procedurally generated terrain with hills and trees
- First-person controls with mouse look and keyboard movement
- Block placement and destruction (right-click and left-click)
- Physics with gravity, jumping, and collision detection
- Inventory system with block selection
- Day-night cycle with a realistic sky
- Minecraft-like visuals with textured blocks

## Controls

- **WASD**: Move
- **Space**: Jump
- **Mouse**: Look around
- **Left Click**: Break blocks
- **Right Click**: Place blocks
- **1-5 Number Keys**: Select block type from inventory
- **P**: Print player position to console (debug)

## Getting Started

1. Clone the repository
2. Add texture images to the `textures/` directory as listed in the textures/readme.txt file
3. Open index.html in your browser
   - For best results, use a local server to serve the files (due to texture loading restrictions)

## Running with a Local Server

You can use any of these methods to run a local server:

### Using Python
```bash
# Python 3
python -m http.server

# Python 2
python -m SimpleHTTPServer
```

### Using Node.js
```bash
# Install http-server globally if you haven't already
npm install -g http-server

# Run the server
http-server
```

## Dependencies

- Three.js (loaded via CDN)
- No additional dependencies required

## Performance Tips

- Reduce the `WORLD_SIZE` constant in main.js to generate a smaller world for better performance
- Reduce the render distance by modifying the camera's far value
- Optimize block rendering by only rendering visible blocks

## License

MIT License - Feel free to use and modify for your own projects! 