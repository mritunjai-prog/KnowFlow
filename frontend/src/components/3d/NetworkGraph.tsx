import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function NetworkGraph() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const nodesCount = 15;
    const nodes: { mesh: THREE.Mesh, velocity: THREE.Vector3 }[] = [];
    const nodeGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const nodeMaterial = new THREE.MeshPhongMaterial({ color: 0xb62515, shininess: 100 });

    for (let i = 0; i < nodesCount; i++) {
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
        node.position.set(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 5
        );
        scene.add(node);
        nodes.push({
            mesh: node,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.005, (Math.random() - 0.5) * 0.005, (Math.random() - 0.5) * 0.005)
        });
    }

    const linesMaterial = new THREE.LineBasicMaterial({ color: 0x244855, transparent: true, opacity: 0.15 });
    const activeLines: { line: THREE.Line, i: number, j: number }[] = [];

    for (let i = 0; i < nodesCount; i++) {
        for (let j = i + 1; j < nodesCount; j++) {
            const geometry = new THREE.BufferGeometry().setFromPoints([nodes[i].mesh.position, nodes[j].mesh.position]);
            const line = new THREE.Line(geometry, linesMaterial);
            scene.add(line);
            activeLines.push({ line, i, j });
        }
    }

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    camera.position.z = 8;

    let animationId: number;
    function animateThree() {
        animationId = requestAnimationFrame(animateThree);
        
        nodes.forEach(n => {
            n.mesh.position.add(n.velocity);
            if (Math.abs(n.mesh.position.x) > 6) n.velocity.x *= -1;
            if (Math.abs(n.mesh.position.y) > 4) n.velocity.y *= -1;
        });

        activeLines.forEach(l => {
            const dist = nodes[l.i].mesh.position.distanceTo(nodes[l.j].mesh.position);
            if (dist < 4) {
                l.line.visible = true;
                (l.line.material as THREE.Material).opacity = (1 - (dist / 4)) * 0.2;
                const positions = l.line.geometry.attributes.position.array as Float32Array;
                positions[0] = nodes[l.i].mesh.position.x;
                positions[1] = nodes[l.i].mesh.position.y;
                positions[2] = nodes[l.i].mesh.position.z;
                positions[3] = nodes[l.j].mesh.position.x;
                positions[4] = nodes[l.j].mesh.position.y;
                positions[5] = nodes[l.j].mesh.position.z;
                l.line.geometry.attributes.position.needsUpdate = true;
            } else {
                l.line.visible = false;
            }
        });

        renderer.render(scene, camera);
    }

    const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    animateThree();

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationId);
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
        }
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />;
}
