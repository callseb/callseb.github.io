// script.js — entry animation + handoff
document.addEventListener("DOMContentLoaded", () => {
  const entry = document.getElementById("entry");
  const ufo   = document.getElementById("ufoSvg");
  const btn   = document.getElementById("enterBtn");
  const hint  = document.getElementById("hint");
  const skip  = document.getElementById("tour-skip");

  // saucer idle bob
  gsap.to(ufo, { y:"-=8", duration:2.2, repeat:-1, yoyo:true, ease:"sine.inOut" });

  function takeoffIntoHole() {
    // spiral path to center screen (roughly the black hole center)
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const sx = ufo.getBoundingClientRect().left + ufo.clientWidth/2;
    const sy = ufo.getBoundingClientRect().top  + ufo.clientHeight/2;

    const path = [
      { x: sx,            y: sy },
      { x: sx + 80,       y: sy - 50 },
      { x: cx - 120,      y: cy - 80 },
      { x: cx - 40,       y: cy - 10 },
      { x: cx,            y: cy }
    ];

    gsap.registerPlugin(MotionPathPlugin);
    const tl = gsap.timeline({
      defaults:{ ease:"power3.inOut" },
      onComplete: () => {
        // fade out entry, boot 3D
        gsap.to(entry, { autoAlpha: 0, duration: 0.6, onComplete: () => entry.style.display = "none" });
        if (window.initSolarSystem) window.initSolarSystem();

        // short overview then lock Mercury
        setTimeout(() => {
          if (window.focusNext) window.focusNext(+1); // Sun -> Mercury
          gsap.to(hint, { opacity: 1, duration: .6 });
        }, 800);
      }
    });

    tl.to(ufo, {
      duration: 1.4,
      motionPath: { path, curviness: 1.2, autoRotate: true },
      scale: 0.8
    })
    .to(ufo, { duration: 0.9, rotation: "+=360", scale: 0.45 }, "-=0.7")
    .to(ufo, { duration: 0.6, rotation: "+=360", scale: 0.12, opacity: 0.0 }, "-=0.3");
  }

  btn.addEventListener("click", takeoffIntoHole);
});
