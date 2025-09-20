// script.js — connects the entry layer to the solar system
document.addEventListener("DOMContentLoaded", () => {
  const btn   = document.getElementById("ufo-btn");
  const entry = document.getElementById("entry");
  const hint  = document.getElementById("hint");

  // Prepare entry layer + main system
  if (window.initEntry) window.initEntry();
  if (window.initSolarSystem) window.initSolarSystem();

  if (btn){
    btn.addEventListener("click", () => {
      // Play the Dali-esque wormhole takeoff, then start the overview tour
      if (window.playEntry){
        window.playEntry(() => {
          // Show hint and start overview → Mercury
          if (hint) gsap.to(hint, { opacity: 1, duration:.5 });
          if (window.startWelcomeSequence) window.startWelcomeSequence();
        });
      } else {
        // fallback: just hide entry & start tour
        if (entry){ entry.style.display="none"; }
        if (hint) gsap.to(hint, { opacity: 1, duration:.5 });
        if (window.startWelcomeSequence) window.startWelcomeSequence();
      }
    });
  }
});
