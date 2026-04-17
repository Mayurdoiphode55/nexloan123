"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box, Wireframe } from "@react-three/drei";
import * as THREE from "three";

function ScannerBox() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Oscillate up and down to simulate scanning
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.5;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <Box ref={meshRef} args={[3, 0.1, 2]}>
      <meshBasicMaterial color="#14b8a6" transparent opacity={0.2} />
      <Wireframe stroke={"#14b8a6"} thickness={0.05} />
    </Box>
  );
}

export default function DocumentScanner3D() {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
      <Canvas camera={{ position: [0, 2, 4], fov: 50 }}>
        <ambientLight intensity={1} />
        <ScannerBox />
      </Canvas>
    </div>
  );
}
