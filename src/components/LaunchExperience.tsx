import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ComingSoon } from "./ComingSoon";
import "./launch-experience.css";

/** A finite brand transition, not a simulated network or wallet operation. */
export function LaunchExperience() {
  const root = useRef<HTMLDivElement>(null);
  const destination = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(true);

  useLayoutEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let finished = false;
    let focusFrame = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.body.style.overflow = previousOverflow;
      setEntering(false);
      focusFrame = requestAnimationFrame(() => {
        destination.current
          ?.querySelector("h1")
          ?.focus({ preventScroll: true });
      });
    };
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ onComplete: finish });
      if (preference.matches) {
        timeline.to(".launch-overlay", { opacity: 0, duration: 0.16 });
        return;
      }
      timeline
        .fromTo(
          ".launch-wave i",
          { scaleY: 0.025, opacity: 0 },
          {
            scaleY: 1,
            opacity: 1,
            duration: 0.6,
            stagger: { each: 0.014, from: "center" },
            ease: "power3.out",
          },
          0,
        )
        .fromTo(
          ".launch-monogram",
          { opacity: 0, scale: 0.72, rotate: -12 },
          {
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 0.65,
            ease: "power3.out",
          },
          0.25,
        )
        .fromTo(
          ".launch-word span",
          { yPercent: 115, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            stagger: 0.026,
            duration: 0.45,
            ease: "power3.out",
          },
          0.42,
        )
        .fromTo(
          ".launch-caption",
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
          },
          0.65,
        )
        .fromTo(
          ".launch-track i",
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1.15,
            ease: "power2.inOut",
          },
          0.12,
        )
        .to(
          ".launch-wave i",
          {
            scaleY: 0.01,
            opacity: 0.3,
            duration: 0.45,
            stagger: { each: 0.007, from: "edges" },
            ease: "power3.inOut",
          },
          1.08,
        )
        .to(
          ".launch-identity",
          { y: -22, opacity: 0, duration: 0.3, ease: "power2.in" },
          1.35,
        )
        .to(
          ".launch-overlay",
          {
            clipPath: "inset(0% 0% 100% 0% round 0px 0px 60px 60px)",
            duration: 0.6,
            ease: "power3.inOut",
          },
          1.48,
        );
    }, root);
    const reduce = () => {
      if (preference.matches) {
        context.revert();
        finish();
      }
    };
    preference.addEventListener("change", reduce);
    return () => {
      context.revert();
      cancelAnimationFrame(focusFrame);
      preference.removeEventListener("change", reduce);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div ref={root} className="launch-experience">
      <div
        ref={destination}
        inert={entering}
        aria-hidden={entering || undefined}
      >
        <ComingSoon />
      </div>
      {entering && (
        <div
          className="launch-overlay"
          role="status"
          aria-live="polite"
          aria-label="Entering MANDEVYR"
        >
          <div className="launch-coordinate" aria-hidden="true">
            <span>MV / APPLICATION</span>
            <span>INTELLIGENCE IN MOTION</span>
          </div>
          <div className="launch-wave" aria-hidden="true">
            {Array.from({ length: 36 }, (_, index) => (
              <i
                key={index}
                style={{
                  height: `${12 + 88 * Math.exp(-(((index - 17.5) / 10) ** 2))}%`,
                }}
              />
            ))}
          </div>
          <div className="launch-identity" aria-hidden="true">
            <div className="launch-monogram">
              <img src="/logo-remove-bg.png" alt="" width="86" height="86" />
            </div>
            <div className="launch-word">
              {"MANDEVYR".split("").map((letter, index) => (
                <span key={index}>{letter}</span>
              ))}
            </div>
            <p className="launch-caption">YOUR CAPITAL. YOUR COMMAND.</p>
          </div>
          <div className="launch-foot" aria-hidden="true">
            <span>ENTERING MANDEVYR</span>
            <div className="launch-track">
              <i />
            </div>
            <span>A NEW PERSPECTIVE.</span>
          </div>
        </div>
      )}
    </div>
  );
}
