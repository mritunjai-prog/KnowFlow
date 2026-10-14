import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
export function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;
    const vertex = gl.createShader(gl.VERTEX_SHADER);
    const fragment = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    const buffer = gl.createBuffer();
    let frame = 0;
    let observer: ResizeObserver | undefined;
    const dispose = () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    };
    if (!vertex || !fragment || !program || !buffer) {
      dispose();
      return;
    }
    gl.shaderSource(vertex, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
    gl.compileShader(vertex);
    gl.shaderSource(
      fragment,
      'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 p=gl_FragCoord.xy/r;float n=sin(p.x*4.+t*.05)*cos(p.y*3.-t*.04);gl_FragColor=vec4(mix(vec3(.984,.914,.816),vec3(.565,.682,.678),n*.06+.08),1.);}',
    );
    gl.compileShader(fragment);
    if (
      !gl.getShaderParameter(vertex, gl.COMPILE_STATUS) ||
      !gl.getShaderParameter(fragment, gl.COMPILE_STATUS)
    ) {
      dispose();
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      dispose();
      return;
    }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, 't');
    const resolution = gl.getUniformLocation(program, 'r');
    const resize = () => {
      canvas.width = Math.max(1, canvas.clientWidth);
      canvas.height = Math.max(1, canvas.clientHeight);
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const render = (t: number) => {
      if (document.hidden || gl.isContextLost()) {
        frame = 0;
        return;
      }
      {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(time, t / 1000);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) frame = requestAnimationFrame(render);
    };
    document.addEventListener('visibilitychange', resume);
    frame = requestAnimationFrame(render);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      dispose();
    };
  }, [reduced]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full bg-sand"
    />
  );
}
