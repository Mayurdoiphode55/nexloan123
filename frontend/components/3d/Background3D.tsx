"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.08;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={1.5}>
      <mesh ref={meshRef} position={[-1.5, 0.5, -3]} scale={2.2}>
        <torusKnotGeometry args={[1, 0.35, 128, 32]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#4c1d95"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
          wireframe={false}
          transparent
          opacity={0.35}
        />
      </mesh>
    </Float>
  );
}

function FloatingOrb({ position, color, size }: { position: [number, number, number]; color: string; size: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const speed = useMemo(() => 0.3 + Math.random() * 0.5, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.6;
      meshRef.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * speed * 0.7) * 0.3;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={0.25}
        roughness={0.1}
        metalness={0.9}
      />
    </mesh>
  );
}

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const purple = new THREE.Color("#7c3aed");
    const blue = new THREE.Color("#3b82f6");

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;

      const c = Math.random() > 0.5 ? purple : blue;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.015;
      pointsRef.current.rotation.x = state.clock.elapsedTime * 0.008;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function Background3D() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 1.5]}
        style={{ background: '#030712' }}
      >
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 5, 20]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#a78bfa" />
        <pointLight position={[-5, -3, 3]} intensity={0.8} color="#7c3aed" />
        <pointLight position={[3, 4, -2]} intensity={0.5} color="#3b82f6" />

        <AnimatedSphere />

        <FloatingOrb position={[3, 1.5, -4]} color="#a855f7" size={0.6} />
        <FloatingOrb position={[-3, -2, -6]} color="#3b82f6" size={0.8} />
        <FloatingOrb position={[1, -3, -5]} color="#6d28d9" size={0.5} />

        <Particles />
      </Canvas>
    </div>
  );
}
