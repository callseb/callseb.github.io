// Welcome → init scene → overview → lock on Mercury
document.addEventListener("DOMContentLoaded", () => {
  const btn   = document.getElementById("ufo-btn");
  const intro = document.getElementById("intro");
  const hint  = document.getElementById("hint");

  if (!btn) return;

  btn.addEventListener("click", () => {
    // fade welcome out
    if (intro) {
      gsap.to(intro, { autoAlpha: 0, duration: 0.6, onComplete: () => intro.style.display = "none" });
    }

    // boot 3D
    if (window.initSolarSystem) window.initSolarSystem();

    // hint after a moment
    if (hint) gsap.to(hint, { opacity: 1, delay: 1.2, duration: .6 });

    // run the overview → Mercury focus
    if (window.startWelcomeSequence) window.startWelcomeSequence();
  });
});
