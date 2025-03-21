/**
 * GPU Helper - Utilities for detecting and forcing GPU acceleration
 */
const GPUHelper = {
    /**
     * Check if the browser is likely using GPU acceleration
     * @returns {boolean} True if GPU acceleration is detected
     */
    detectGPU() {
        // Try several detection methods
        try {
            // Method 1: Canvas WebGL detection
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                console.warn('WebGL not supported');
                return false;
            }
            
            // Method 2: Debug renderer info
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                
                // Log detected GPU info
                console.log('GPU Info:', { renderer, vendor });
                
                // Look for indicators of dedicated GPU
                const gpuKeywords = [
                    'nvidia', 'geforce', 'rtx', 'gtx',
                    'amd', 'radeon', 'rx', 
                    'intel', 'iris', 'hd graphics',
                    'apple gpu', 'metal'
                ];
                
                // Check if any GPU keyword is in the renderer string
                const isGPU = gpuKeywords.some(keyword => 
                    renderer.toLowerCase().includes(keyword));
                
                return isGPU;
            }
            
            // Method 3: Hardware concurrency
            if (navigator.hardwareConcurrency > 4) {
                console.log('Multiple CPU cores detected, likely has GPU capability');
                return true;
            }
            
            return false;
        } catch (e) {
            console.error('Error detecting GPU:', e);
            return false;
        }
    },
    
    /**
     * Force GPU rendering in supported browsers
     */
    forceGPURendering() {
        try {
            // Chrome flags via CSS
            this.addGPUStyles();
            
            // Create a hidden 3D object to wake up the GPU
            this.createGPUTrigger();
            
            // Force hardware acceleration hints
            document.body.style.backfaceVisibility = 'hidden';
            
            console.log('GPU rendering forced');
            return true;
        } catch (e) {
            console.error('Error forcing GPU rendering:', e);
            return false;
        }
    },
    
    /**
     * Add CSS rules that encourage GPU usage
     */
    addGPUStyles() {
        const style = document.createElement('style');
        style.textContent = `
            body {
                transform: translateZ(0);
                backface-visibility: hidden;
                perspective: 1000px;
                -webkit-transform: translateZ(0);
                -webkit-backface-visibility: hidden;
                -webkit-perspective: 1000px;
            }
            canvas {
                transform: translate3d(0,0,0);
                -webkit-transform: translate3d(0,0,0);
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
                will-change: transform;
            }
        `;
        document.head.appendChild(style);
    },
    
    /**
     * Create a hidden WebGL object to activate the GPU
     */
    createGPUTrigger() {
        // Create hidden canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        canvas.style.position = 'absolute';
        canvas.style.opacity = '0';
        canvas.style.pointerEvents = 'none';
        document.body.appendChild(canvas);
        
        // Create simple WebGL context and animation
        const gl = canvas.getContext('webgl', {
            powerPreference: 'high-performance',
            antialias: false
        });
        
        if (gl) {
            // Create simple shader program
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, `
                attribute vec2 position;
                void main() {
                    gl_Position = vec4(position, 0.0, 1.0);
                }
            `);
            gl.compileShader(vertexShader);
            
            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, `
                precision lowp float;
                void main() {
                    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
                }
            `);
            gl.compileShader(fragmentShader);
            
            // Create program
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            gl.useProgram(program);
            
            // Create buffer with a triangle
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1.0, -1.0,
                1.0, -1.0,
                0.0, 1.0
            ]), gl.STATIC_DRAW);
            
            // Setup attributes
            const positionLocation = gl.getAttribLocation(program, 'position');
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            
            // Render a single frame to wake up the GPU
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.flush();
            
            console.log('GPU trigger created');
        }
    },
    
    /**
     * Get detailed GPU information
     * @returns {Object} GPU information object
     */
    getGPUInfo() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return { supported: false, reason: 'WebGL not supported' };
            }
            
            const info = {
                supported: true,
                webglVersion: 1,
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER)
            };
            
            // Try to get more detailed info
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                info.vendorUnmasked = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                info.rendererUnmasked = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                info.isGPU = this.detectGPU();
            }
            
            return info;
        } catch (e) {
            console.error('Error getting GPU info:', e);
            return { supported: false, reason: e.message };
        }
    }
};

export default GPUHelper; 