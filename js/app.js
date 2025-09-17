// year
document.getElementById('year').textContent = new Date().getFullYear();

// Intro motion
window.addEventListener('load', () => {
  const cells = document.querySelectorAll('.cell');
  gsap.set(cells, { opacity: 0, y: 20, scale: 0.98 });
  gsap.to(cells, {
    opacity: 1, y: 0, scale: 1,
    stagger: { each: 0.04, from: 'random' },
    duration: 0.6, ease: 'power2.out', delay: 0.2
  });

  // Hero text rise
  gsap.from('.hero__content > *', {
    y: 20, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out'
  });
});

// Scroll reveals
gsap.registerPlugin(ScrollTrigger);
gsap.utils.toArray('.section').forEach((sec) => {
  gsap.from(sec.querySelectorAll('h2, p, .cards, .contact'), {
    opacity: 0, y: 24, duration: 0.6, ease: 'power2.out',
    scrollTrigger: { trigger: sec, start: 'top 75%' }
  });
});

// Micro-interaction: card tilt
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const rx = ((y / r.height) - 0.5) * -4;
    const ry = ((x / r.width) - 0.5) * 4;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});
