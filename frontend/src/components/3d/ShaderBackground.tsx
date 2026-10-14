import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const vertexSource = `
        attribute vec2 position;
        varying vec2 v_texCoord;
        void main() {
            v_texCoord = position * 0.5 + 0.5;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;
const fragmentSource = `
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
                    m += (1.0 - smoothstep(0.04, 0.05, dist)) * h;
                }
            }
            base += m * 0.1;

            gl_FragColor = vec4(base, 1.0);
        }
    `;

export function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced) return;
    let gl: WebGLRenderingContext | null;
    try {
      gl = canvas.getContext('webgl');
    } catch {
      return;
    }
    if (!gl) return;
    const context = gl;
    const vertex = context.createShader(context.VERTEX_SHADER);
    const fragment = context.createShader(context.FRAGMENT_SHADER);
    const program = context.createProgram();
    const buffer = context.createBuffer();
    let frame = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const dispose = () => {
      stop();
      if (buffer) context.deleteBuffer(buffer);
      if (program) context.deleteProgram(program);
      if (vertex) context.deleteShader(vertex);
      if (fragment) context.deleteShader(fragment);
    };
    if (!vertex || !fragment || !program || !buffer) {
      dispose();
      return;
    }
    context.shaderSource(vertex, vertexSource);
    context.compileShader(vertex);
    context.shaderSource(fragment, fragmentSource);
    context.compileShader(fragment);
    if (
      !context.getShaderParameter(vertex, context.COMPILE_STATUS) ||
      !context.getShaderParameter(fragment, context.COMPILE_STATUS)
    ) {
      dispose();
      return;
    }
    context.attachShader(program, vertex);
    context.attachShader(program, fragment);
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) {
      dispose();
      return;
    }
    context.useProgram(program);
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(
      context.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      context.STATIC_DRAW,
    );
    const position = context.getAttribLocation(program, 'position');
    if (position < 0) {
      dispose();
      return;
    }
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
    const time = context.getUniformLocation(program, 'u_time');
    const resolution = context.getUniformLocation(program, 'u_resolution');
    let last = 0;
    const render = (now: number) => {
      frame = 0;
      if (document.hidden || context.isContextLost()) return;
      if (now - last >= 1000 / 30) {
        last = now;
        context.viewport(0, 0, canvas.width, canvas.height);
        context.uniform1f(time, now / 1000);
        context.uniform2f(resolution, canvas.width, canvas.height);
        context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
      }
      frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (document.hidden) stop();
      else if (!frame) frame = requestAnimationFrame(render);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      stop();
      canvas.style.visibility = 'hidden';
    };
    const restored = () => setGeneration((value) => value + 1);
    const resize = () => {
      canvas.width = Math.max(1, canvas.clientWidth);
      canvas.height = Math.max(1, canvas.clientHeight);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.style.visibility = '';
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    document.addEventListener('visibilitychange', resume);
    resume();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      dispose();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [reduced, generation]);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-sand via-surface-dim to-sage/60"
    >
      <canvas data-login-shader ref={ref} className="h-full w-full" />
    </div>
  );
}
