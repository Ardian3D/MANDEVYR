import { useEffect, useRef } from "react";

/** A decorative spotlight and snapped cell, updated without React rerenders. */
export function HoverGrid() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = layer.current;
    const section = element?.parentElement;
    if (!element || !section) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const paint = () => {
      frame = 0;
      const bounds = section.getBoundingClientRect();
      const x = pointerX - bounds.left;
      const y = pointerY - bounds.top;
      element.style.setProperty("--grid-x", `${x}px`);
      element.style.setProperty("--grid-y", `${y}px`);
      element.style.setProperty("--cell-x", `${Math.floor(x / 52) * 52}px`);
      element.style.setProperty("--cell-y", `${Math.floor(y / 52) * 52}px`);
      element.dataset.active = "true";
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      element.dataset.active = "false";
    };

    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    section.addEventListener("pointercancel", leave);
    window.addEventListener("scroll", leave, { passive: true });
    window.addEventListener("blur", leave);
    return () => {
      leave();
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
      section.removeEventListener("pointercancel", leave);
      window.removeEventListener("scroll", leave);
      window.removeEventListener("blur", leave);
    };
  }, []);

  return (
    <div ref={layer} className="hover-grid" aria-hidden="true">
      <div className="hover-grid-light" />
      <div className="hover-grid-cell" />
    </div>
  );
}
