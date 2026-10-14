import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import * as THREE from 'three';

export function NetworkGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const container = ref.current;
    if (!container || reduced) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    const canvas = renderer.domElement;
    container.appendChild(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 8;
    const geometry = new THREE.SphereGeometry(0.12, 16, 16);
    const material = new THREE.MeshPhongMaterial({ color: 0xb62515, shininess: 100 });
    const nodes = Array.from({ length: 15 }, () => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 5,
      );
      scene.add(mesh);
      return {
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005,
        ),
      };
    });
    const lines: {
      line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
      i: number;
      j: number;
    }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            nodes[i].mesh.position,
            nodes[j].mesh.position,
          ]),
          new THREE.LineBasicMaterial({ color: 0x244855, transparent: true, opacity: 0.15 }),
        );
        scene.add(line);
        lines.push({ line, i, j });
      }
    }
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 2);
    scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));
    let frame = 0;
    let last = performance.now();
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const render = (now: number) => {
      frame = 0;
      if (document.hidden || renderer.getContext().isContextLost()) return;
      if (now - last >= 1000 / 30) {
        const delta = Math.min((now - last) / (1000 / 60), 3);
        last = now;
        nodes.forEach(({ mesh, velocity }) => {
          mesh.position.addScaledVector(velocity, delta);
          if (Math.abs(mesh.position.x) > 6) velocity.x *= -1;
          if (Math.abs(mesh.position.y) > 4) velocity.y *= -1;
          if (Math.abs(mesh.position.z) > 3) velocity.z *= -1;
        });
        lines.forEach(({ line, i, j }) => {
          const first = nodes[i].mesh.position;
          const second = nodes[j].mesh.position;
          const distance = first.distanceTo(second);
          line.visible = distance < 4;
          if (!line.visible) return;
          line.material.opacity = (1 - distance / 4) * 0.2;
          const position = line.geometry.getAttribute('position');
          position.setXYZ(0, first.x, first.y, first.z);
          position.setXYZ(1, second.x, second.y, second.z);
          position.needsUpdate = true;
        });
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(render);
    };
    const resume = () => {
      if (document.hidden) stop();
      else if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(render);
      }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      stop();
      canvas.style.visibility = 'hidden';
    };
    const restored = () => {
      canvas.style.visibility = '';
      resume();
    };
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    document.addEventListener('visibilitychange', resume);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    resume();
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      geometry.dispose();
      material.dispose();
      lines.forEach(({ line }) => {
        line.geometry.dispose();
        line.material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [reduced]);
  return (
    <div
      ref={ref}
      data-login-network
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
