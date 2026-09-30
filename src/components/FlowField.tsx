import { useEffect, useRef } from "react";

/** Original generative contour sculpture. No texture downloads or WebGL runtime. */
export function FlowField({ motion }: { motion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      frame = 0,
      time = 0,
      visible = true,
      last = 0;
    let pointer = 0,
      targetPointer = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const scale = Math.max(width * 0.57, 430);
      const center = height * 0.64;
      pointer += (targetPointer - pointer) * 0.035;
      for (let row = 0; row < 66; row++) {
        const v = (row / 66) * Math.PI * 2;
        ctx.beginPath();
        for (let step = 0; step <= 180; step++) {
          const u = (step / 180) * Math.PI * 2;
          const radius = 1 + 0.22 * Math.cos(v + Math.sin(u * 3 + time) * 0.3);
          const x = Math.cos(u) * radius;
          const y = Math.sin(u) * radius;
          const z = 0.26 * Math.sin(v) + 0.12 * Math.sin(u * 2 + time);
          const screenX = width / 2 + x * scale + pointer * z * 25;
          const screenY = center + (y * 0.36 + z * 0.9) * scale;
          if (step === 0) ctx.moveTo(screenX, screenY);
          else ctx.lineTo(screenX, screenY);
        }
        const light = (Math.sin(v) + 1) / 2;
        ctx.strokeStyle = `rgba(${105 + light * 61},${165 + light * 53},${143 + light * 43},${0.035 + light * 0.18})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
    };
    const tick = (now: number) => {
      if (visible && !document.hidden && now - last > 32) {
        time += 0.006;
        last = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      draw();
      if (motion && !media.matches) frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio, 1.5);
      element.width = width * ratio;
      element.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    });
    resize.observe(element);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(element);
    const move = (e: PointerEvent) => {
      targetPointer = (e.clientX / window.innerWidth) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    media.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      media.removeEventListener("change", start);
    };
  }, [motion]);
  return <canvas ref={canvas} className="flow-field" aria-hidden="true" />;
}
