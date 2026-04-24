"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function Orb({ isTyping }: { isTyping: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const time = useRef(0);

  useFrame((state, delta) => {
    time.current += delta;
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
      // Pulse scale when typing
      const scale = isTyping
        ? 1 + Math.sin(time.current * 5) * 0.1
        : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} scale={1.2}>
      <MeshDistortMaterial
        color="#a855f7"
        attach="material"
        distort={isTyping ? 0.6 : 0.3}
        speed={isTyping ? 5 : 2}
        roughness={0.1}
        metalness={0.9}
        emissive="#7c3aed"
        emissiveIntensity={2}
      />
    </Sphere>
  );
}

export default function AIOrbAvatar({ isTyping = false }: { isTyping?: boolean }) {
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 border border-indigo-500/30 flex items-center justify-center">
      <Canvas camera={{ position: [0, 0, 3] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 2, 2]} intensity={1} />
        <Orb isTyping={isTyping} />
      </Canvas>
    </div>
  );
}
