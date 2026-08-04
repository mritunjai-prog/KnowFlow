import { useEffect, useRef } from 'react';

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vsSource = `
        attribute vec2 position;
        varying vec2 v_texCoord;
        void main() {
            v_texCoord = position * 0.5 + 0.5;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const fsSource = `
        precision highp float;
        varying vec2 v_texCoord;
        uniform float u_time;
        uniform vec2 u_resolution;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
            vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.y, u_resolution.x);
            
            float n = noise(p * 2.0 + u_time * 0.1);
            vec3 color1 = vec3(0.141, 0.282, 0.333); // #244855
            vec3 color2 = vec3(0.984, 0.914, 0.816); // #fbe9d0
            vec3 base = mix(color2, color1, n * 0.3);
            
            float stream = fract(p.y * 10.0 + u_time * 0.5 + noise(vec2(p.x * 2.0, u_time * 0.1)));
            float line = smoothstep(0.98, 1.0, 1.0 - abs(stream - 0.5) * 2.0);
            base += line * vec3(0.902, 0.282, 0.2) * 0.4; // Reduced opacity for background
            
            vec2 gv = fract(p * 5.0) - 0.5;
            vec2 id = floor(p * 5.0);
            float m = 0.0;
            for(float y=-1.0; y<=1.0; y++) {
                for(float x=-1.0; x<=1.0; x++) {
                    vec2 offs = vec2(x, y);
                    float h = hash(id + offs);
                    vec2 pos = offs + vec2(sin(u_time * h), cos(u_time * h)) * 0.4;
                    float dist = length(gv - pos);
                    m += smoothstep(0.05, 0.04, dist) * h;
                }
            }
            base += m * 0.1;
            
            gl_FragColor = vec4(base, 1.0);
        }
    `;

    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    const program = gl.createProgram();
    if (!program) return;
    
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "position");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    let animationId: number;
    let startTime = performance.now();

    function render(time: number) {
        if (!canvas || !gl) return;
        const elapsed = time - startTime;
        const timeInSeconds = elapsed * 0.001;
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1f(timeLocation, timeInSeconds);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        animationId = requestAnimationFrame(render);
    }
    
    animationId = requestAnimationFrame(render);

    return () => {
        cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0" />;
}
