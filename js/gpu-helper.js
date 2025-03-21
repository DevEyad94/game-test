/**
 * GPU Acceleration Helper
 * Provides utilities to force GPU acceleration in supported browsers
 */

// Check if GPU acceleration is available in this browser
function isGPUAccelerationAvailable() {
    // Chrome supports force-enabled GPU
    if (navigator.userAgent.indexOf('Chrome') !== -1) {
        return true;
    }
    
    // Safari on Mac often has good GPU acceleration
    if (navigator.userAgent.indexOf('Safari') !== -1 && 
        navigator.userAgent.indexOf('Mac') !== -1) {
        return true;
    }
    
    // Firefox has some GPU acceleration but not as controllable
    if (navigator.userAgent.indexOf('Firefox') !== -1) {
        return "limited";
    }
    
    return false;
}

// Force GPU rendering in supported browsers
function forceGPURendering() {
    // Create a hidden canvas that forces GPU acceleration
    const gpuForcer = document.createElement('canvas');
    gpuForcer.id = 'gpu-forcer';
    gpuForcer.width = 16;
    gpuForcer.height = 16;
    gpuForcer.style.position = 'absolute';
    gpuForcer.style.bottom = '0';
    gpuForcer.style.right = '0';
    gpuForcer.style.width = '1px';
    gpuForcer.style.height = '1px';
    gpuForcer.style.opacity = '0.01';
    
    // Apply the strongest transform we can to force GPU rendering
    gpuForcer.style.transform = 'translateZ(0) scale3d(1,1,1)';
    gpuForcer.style.webkitTransform = 'translateZ(0) scale3d(1,1,1)';
    
    // Add the "will-change" property to suggest GPU rendering
    gpuForcer.style.willChange = 'transform';
    
    // Add a WebGL context to the canvas to encourage GPU usage
    try {
        const ctx = gpuForcer.getContext('webgl', { 
            powerPreference: 'high-performance',
            desynchronized: false,
            antialias: false,
            depth: true
        });
        
        // Draw something small to activate the context
        if (ctx) {
            ctx.clearColor(0, 0, 0, 0);
            ctx.clear(ctx.COLOR_BUFFER_BIT);
        }
    } catch (e) {
        console.warn('Could not create WebGL context for GPU forcing', e);
    }
    
    // Add to document body
    document.body.appendChild(gpuForcer);
    
    // Also apply styles to the main container
    const container = document.getElementById('game-container');
    if (container) {
        container.style.transform = 'translateZ(0)'; 
        container.style.webkitTransform = 'translateZ(0)';
        container.style.willChange = 'transform';
    }
    
    console.log('GPU rendering forced');
    return true;
}

// Add CSS rules to encourage browser to use GPU
function addGPUStyles() {
    const style = document.createElement('style');
    style.textContent = `
        body, canvas, #game-container {
            transform: translateZ(0);
            will-change: transform;
            -webkit-transform: translateZ(0);
            -webkit-backface-visibility: hidden;
        }
    `;
    document.head.appendChild(style);
}

// Check if hardware acceleration is enabled in Chrome
function isChromeHardwareAccelerationEnabled() {
    // This is a best-effort detection and not foolproof
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    
    if (!gl) {
        return false;
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
        return "unknown";
    }
    
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return !renderer.includes('SwiftShader') && !renderer.includes('Software');
}

// Public API
export default {
    isGPUAccelerationAvailable,
    forceGPURendering,
    addGPUStyles,
    isChromeHardwareAccelerationEnabled
}; 