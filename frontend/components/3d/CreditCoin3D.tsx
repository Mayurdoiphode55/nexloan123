"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Cylinder, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function Coin() {
  const meshRef = useRef<THREE.Mesh>(null);

  const time = useRef(0);

  useFrame((state, delta) => {
    time.current += delta;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.5; // fast spin
      meshRef.current.rotation.z = Math.sin(time.current) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={1}>
      <Cylinder ref={meshRef} args={[1.5, 1.5, 0.2, 64]} rotation={[Math.PI / 2, 0, 0]}>
        <MeshDistortMaterial
          color="#fcd34d"
          metalness={1}
          roughness={0.2}
          envMapIntensity={2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          distort={0.1}
          speed={2}
        />
      </Cylinder>
    </Float>
  );
}

export default function CreditCoin3D() {
  return (
    <div className="w-16 h-16 ml-auto relative">
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />
        <Coin />
      </Canvas>
    </div>
  );
}
