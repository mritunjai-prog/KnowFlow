import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';

export function LandingHeroGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduced) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Group to hold the graph for easier rotation
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // Knowledge Graph Nodes (Spheres)
    const nodesCount = 150;
    const nodes: {
      mesh: THREE.Mesh;
      originalPos: THREE.Vector3;
      offset: number;
      velocity: THREE.Vector3;
    }[] = [];

    // Core node
    const coreGeometry = new THREE.IcosahedronGeometry(1.5, 1);
    const coreMaterial = new THREE.MeshPhongMaterial({
      color: 0xe64833,
      emissive: 0xe64833,
      emissiveIntensity: 0.5,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    graphGroup.add(coreMesh);

    const nodeGeometry = new THREE.SphereGeometry(0.12, 12, 12);

    // Use colors from the design system: #e64833 (Coral), #244855 (Teal), #90aead (Outline)
    const colors = [0xe64833, 0x244855, 0x90aead];

    for (let i = 0; i < nodesCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.4,
        shininess: 100,
      });
      const node = new THREE.Mesh(nodeGeometry, material);

      // Position in a larger loose spherical cloud
      const phi = Math.acos(-1 + (2 * i) / nodesCount);
      const theta = Math.sqrt(nodesCount * Math.PI) * phi;
      const radius = 3 + Math.random() * 6;

      node.position.set(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi),
      );

      graphGroup.add(node);
      nodes.push({
        mesh: node,
        originalPos: node.position.clone(),
        offset: Math.random() * Math.PI * 2,
        velocity: new THREE.Vector3(),
      });
    }

    // Dynamic Connections (Lines)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x244855,
      transparent: true,
      opacity: 0.15,
    });
    const connectionThreshold = 2.5;
    const lines: { line: THREE.Line; i: number; j: number }[] = [];

    // Pre-calculate pairs to avoid O(n^2) every frame
    const pairs: [number, number][] = [];
    for (let i = 0; i < nodesCount; i++) {
      for (let j = i + 1; j < nodesCount; j++) {
        if (nodes[i].originalPos.distanceTo(nodes[j].originalPos) < connectionThreshold + 1) {
          pairs.push([i, j]);
        }
      }
    }

    pairs.forEach(([i, j]) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        nodes[i].mesh.position,
        nodes[j].mesh.position,
      ]);
      const line = new THREE.Line(geometry, lineMaterial);
      graphGroup.add(line);
      lines.push({ line, i, j });
    });

    // Lighting
    const pointLight = new THREE.PointLight(0xe64833, 2, 50);
    pointLight.position.set(0, 0, 0); // inside core
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    camera.position.z = 12;

    // Mouse Interaction
    const mouse = new THREE.Vector2();
    const targetMouse = new THREE.Vector2();

    const handleMouseMove = (event: MouseEvent) => {
      targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let time = 0;
    let animationId = 0;
    let visible = true;
    function animate() {
      if (document.hidden || !visible || renderer.getContext().isContextLost()) {
        animationId = 0;
        return;
      }
      animationId = requestAnimationFrame(animate);
      time += 0.01;

      // Smooth mouse interpolation
      mouse.x += (targetMouse.x - mouse.x) * 0.05;
      mouse.y += (targetMouse.y - mouse.y) * 0.05;

      // Gentle group rotation
      graphGroup.rotation.y += 0.002;
      graphGroup.rotation.x += 0.001;

      // Core pulsating
      const coreScale = 1 + Math.sin(time * 2) * 0.1;
      coreMesh.scale.set(coreScale, coreScale, coreScale);
      coreMesh.rotation.y = time * 0.5;
      coreMesh.rotation.x = time * 0.3;

      // Parallax effect
      camera.position.x += (mouse.x * 2 - camera.position.x) * 0.05;
      camera.position.y += (mouse.y * 2 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Raycaster for node repulsion
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const mousePoint = new THREE.Vector3();
      raycaster.ray.at(10, mousePoint); // Get point at depth 10

      // Individual node breathing & mouse repulsion
      nodes.forEach((n) => {
        // Base hover movement
        const targetX = n.originalPos.x + Math.sin(time * 2 + n.offset) * 0.3;
        const targetY = n.originalPos.y + Math.cos(time * 2 + n.offset) * 0.3;
        const targetZ = n.originalPos.z + Math.sin(time + n.offset) * 0.3;

        // Mouse repulsion logic
        const distToMouse = n.mesh.position.distanceTo(mousePoint);
        if (distToMouse < 4) {
          const force = (4 - distToMouse) * 0.1;
          const direction = n.mesh.position.clone().sub(mousePoint).normalize();
          n.velocity.add(direction.multiplyScalar(force));
        }

        // Apply velocity and spring back
        n.mesh.position.add(n.velocity);
        n.velocity.multiplyScalar(0.9); // friction

        // Spring back to base target
        n.mesh.position.x += (targetX - n.mesh.position.x) * 0.05;
        n.mesh.position.y += (targetY - n.mesh.position.y) * 0.05;
        n.mesh.position.z += (targetZ - n.mesh.position.z) * 0.05;
      });

      // Update lines to follow nodes
      lines.forEach((l) => {
        const p1 = nodes[l.i].mesh.position;
        const p2 = nodes[l.j].mesh.position;

        const dist = p1.distanceTo(p2);
        if (dist < connectionThreshold) {
          const positions = l.line.geometry.attributes.position.array as Float32Array;
          positions[0] = p1.x;
          positions[1] = p1.y;
          positions[2] = p1.z;
          positions[3] = p2.x;
          positions[4] = p2.y;
          positions[5] = p2.z;
          l.line.geometry.attributes.position.needsUpdate = true;
          // Dynamically adjust opacity based on distance
          (l.line.material as THREE.LineBasicMaterial).opacity = 1 - dist / connectionThreshold;
        } else {
          (l.line.material as THREE.LineBasicMaterial).opacity = 0;
        }
      });

      renderer.render(scene, camera);
    }

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resume = () => {
      if (document.hidden || !visible) {
        cancelAnimationFrame(animationId);
        animationId = 0;
      } else if (!animationId) animate();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      resume();
    });
    observer.observe(container);
    document.addEventListener('visibilitychange', resume);
    renderer.domElement.addEventListener('webglcontextrestored', resume);
    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', resume);
      renderer.domElement.removeEventListener('webglcontextrestored', resume);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [reduced]);

  return (
    <div
      aria-hidden="true"
      ref={containerRef}
      className="absolute inset-0 w-full h-full opacity-60 z-0"
    />
  );
}
