import { useEffect, useRef, useState } from "react";
import type { Object3D, Mesh } from "three";

const HOME = { x: -0.15, y: -0.42, z: -0.09 };

/** The mesh is authored in Blender; rendering is demand-driven, not an idle loop. */
export function LogoSculpture() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let dispose = () => {};
    const releaseModel = (model: Object3D) => model.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
    });

    void Promise.all([
      import("three"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/environments/RoomEnvironment.js"),
    ]).then(async ([THREE, { GLTFLoader }, { RoomEnvironment }]) => {
      if (cancelled) return;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
      camera.position.set(0, 0, 6.8);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();
      const key = new THREE.DirectionalLight(0xe8fff6, 4);
      key.position.set(-3, 4, 5);
      const rim = new THREE.DirectionalLight(0x73f1c0, 3);
      rim.position.set(4, 1, -2);
      scene.add(key, rim, new THREE.HemisphereLight(0xe2ffe9, 0x182c24, 2));
      const pivot = new THREE.Group();
      pivot.rotation.set(HOME.x, HOME.y, HOME.z);
      scene.add(pivot);
      const target = { ...HOME };
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0;
      let lastTime = 0;
      let model: Object3D | null = null;
      let pointer: { id: number; x: number; y: number; touch: boolean } | null = null;
      let lost = false;

      const draw = (time: number) => {
        frame = 0;
        if (cancelled || lost) return;
        const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-Math.min(time - lastTime || 16, 64) / 55);
        lastTime = time;
        pivot.rotation.x += (target.x - pivot.rotation.x) * blend;
        pivot.rotation.y += (target.y - pivot.rotation.y) * blend;
        pivot.rotation.z += (target.z - pivot.rotation.z) * blend;
        renderer.render(scene, camera);
        if (Math.abs(target.x - pivot.rotation.x) + Math.abs(target.y - pivot.rotation.y) + Math.abs(target.z - pivot.rotation.z) > 0.0001) invalidate();
      };
      const invalidate = () => { if (!frame && !cancelled && !lost) frame = requestAnimationFrame(draw); };
      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        invalidate();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      const reset = () => { Object.assign(target, HOME); invalidate(); };
      const down = (event: PointerEvent) => {
        if (!model || !event.isPrimary || event.button !== 0) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === "touch" };
        host.setPointerCapture(event.pointerId);
        host.dataset.dragging = "true";
      };
      const move = (event: PointerEvent) => {
        if (!pointer || pointer.id !== event.pointerId) return;
        target.y += (event.clientX - pointer.x) * 0.008;
        if (!pointer.touch) target.x = THREE.MathUtils.clamp(target.x + (event.clientY - pointer.y) * 0.006, -0.8, 0.8);
        pointer.x = event.clientX; pointer.y = event.clientY;
        invalidate();
      };
      const up = (event: PointerEvent) => {
        if (pointer?.id !== event.pointerId) return;
        pointer = null;
        delete host.dataset.dragging;
        if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      };
      const keyboard = (event: KeyboardEvent) => {
        if (!model) return;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Home") return reset();
        if (event.key === "ArrowLeft") target.y -= 0.2;
        if (event.key === "ArrowRight") target.y += 0.2;
        if (event.key === "ArrowUp") target.x = Math.max(-0.8, target.x - 0.15);
        if (event.key === "ArrowDown") target.x = Math.min(0.8, target.x + 0.15);
        invalidate();
      };
      const contextLost = () => { lost = true; cancelAnimationFrame(frame); setState("fallback"); };
      host.addEventListener("pointerdown", down);
      host.addEventListener("pointermove", move);
      host.addEventListener("pointerup", up);
      host.addEventListener("pointercancel", up);
      host.addEventListener("lostpointercapture", up);
      host.addEventListener("keydown", keyboard);
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        host.removeEventListener("pointerdown", down);
        host.removeEventListener("pointermove", move);
        host.removeEventListener("pointerup", up);
        host.removeEventListener("pointercancel", up);
        host.removeEventListener("lostpointercapture", up);
        host.removeEventListener("keydown", keyboard);
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        if (model) releaseModel(model);
        environment.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
      const gltf = await new GLTFLoader().loadAsync("/models/mandevyr-logo.glb");
      if (cancelled) { releaseModel(gltf.scene); return; }
      model = gltf.scene;
      pivot.add(model);
      if (!lost) setState("ready");
      resize();
    }).catch(() => { if (!cancelled) { dispose(); setState("fallback"); } });
    return () => { cancelled = true; dispose(); };
  }, []);

  return <div className={`p0-sculpture p0-sculpture-${state}`}>
    <div className="p0-sculpture-orbit" aria-hidden="true" />
    <div ref={hostRef} className="p0-sculpture-stage" role="group" tabIndex={state === "ready" ? 0 : -1} aria-label="Interactive MANDEVYR 3D logo. Drag to rotate, use arrow keys to turn, or Home to reset.">
      {state !== "ready" && <img className="p0-sculpture-poster" src="/logo-remove-bg.png" alt="MANDEVYR" />}
    </div>
  </div>;
}
