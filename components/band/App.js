"use client";
import "./index.css";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { Canvas, extend, useThree, useFrame } from "@react-three/fiber";
import {
  useGLTF,
  useTexture,
  Environment,
  Lightformer,
} from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { useDrag } from "@use-gesture/react";

extend({ MeshLineGeometry, MeshLineMaterial });

const GLTF_PATH = "/assets/kartu.glb";
const TEXTURE_PATH = "/assets/bandd1.png";

useGLTF.preload(GLTF_PATH);
useTexture.preload(TEXTURE_PATH);

export function BackgroundImage({ url }) {
  const texture = useTexture(url);
  const { scene } = useThree();
  useEffect(() => void (scene.background = texture), [scene, texture]);
  return null;
}

export default function App() {
  return (
    <div className="responsive-wrapper">
      <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
        <ambientLight intensity={Math.PI} />
        <BackgroundImage url="/assets/bg.png" />
        <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
          <Band />
        </Physics>
        <Environment blur={0.75}>
          <color attach="background" args={["white"]} />
          <Lightformer intensity={2} position={[0, -1, 5]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} position={[-1, -1, 1]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} position={[1, 1, 1]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} position={[-10, 0, 14]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
      <img src="/assets/bethany.gif" className="overlay-image" alt="Header" />
    </div>
  );
}

function Band({ maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef();
  const vec = new THREE.Vector3(), ang = new THREE.Vector3(), rot = new THREE.Vector3(), dir = new THREE.Vector3();
  const segmentProps = { type: "dynamic", canSleep: true, colliders: false, angularDamping: 4, linearDamping: 4 };
  const { nodes, materials } = useGLTF(GLTF_PATH);
  const texture = useTexture(TEXTURE_PATH);
  const cardTexture = useTexture("/assets/bandd2.png");
  const cardTexture2 = useTexture("/assets/banddd.png");
  const { size, camera } = useThree();
  const [dragged, setDragged] = useState(null);
  const [hovered, hover] = useState(false);
  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]));

  cardTexture.wrapS = cardTexture.wrapT = THREE.RepeatWrapping;
  cardTexture.repeat.set(1.5, 1.4);
  cardTexture.offset.set(0.12, -0.05);
  cardTexture2.offset.set(0.28, 0);
  cardTexture.flipY = cardTexture2.flipY = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    document.body.style.cursor = hovered ? (dragged ? "grabbing" : "grab") : "auto";
  }, [hovered, dragged]);

  const bind = useDrag(({ active, xy: [x, y] }) => {
    if (active) {
      const ndc = { x: (x / size.width) * 2 - 1, y: -(y / size.height) * 2 + 1 };
      vec.set(ndc.x, ndc.y, 0.5).unproject(camera);
      dir.copy(vec).sub(camera.position).normalize();
      vec.add(dir.multiplyScalar(camera.position.length()));
      setDragged(vec.clone());
    } else {
      setDragged(null);
    }
  });

  useFrame((_, delta) => {
    if (dragged && card.current) {
      card.current.setNextKinematicTranslation(dragged);
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
    }

    if (fixed.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)));
      });
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.lerped);
      curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      band.current.geometry.setPoints(curve.getPoints(32));
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? "kinematicPosition" : "dynamic"}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            {...bind()}
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
          >
            <group>
              <mesh geometry={nodes.card.geometry}><meshStandardMaterial map={cardTexture} side={THREE.FrontSide} /></mesh>
              <mesh geometry={nodes.card.geometry} rotation={[0, Math.PI, 0]}><meshStandardMaterial map={cardTexture2} side={THREE.FrontSide} /></mesh>
            </group>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" depthTest={false} resolution={[size.width, size.height]} useMap map={texture} repeat={[-4, 1]} lineWidth={1} />
      </mesh>
    </>
  );
}