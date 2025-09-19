// Handles the landing → scene handoff and guards init
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("ufo-btn");
  const intro = document.getElementById("intro");
  const hint = document.getElementById("hint");

  if (!btn) return;

  btn.addEventListener("click", () => {
    // fade overlay away
    if (intro) {
      gsap.to(intro, { autoAlpha: 0, duration: 0.6, onComplete: () => intro.style.display = "none" });
    }
    // init the solar system
    if (window.initSolarSystem) window.initSolarSystem();
    // reveal hint after a moment
    gsap.to(hint, { opacity: 1, delay: 1.2, duration: .6 });
  });
});
