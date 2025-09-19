/*
 * Landing page script
 *
 * This script creates a 3D star field using Three.js and adds subtle
 * motion to it.  It also handles user interactions such as moving
 * the mouse (to create a parallax effect), scrolling (to zoom in and
 * out), and clicking the start icon to navigate to the solar system
 * page.
 */

// Wait for the DOM to be fully ready before executing.  Even though
// we load Three.js and GSAP with `defer`, attaching events within
// this handler ensures all elements are available.
window.addEventListener('DOMContentLoaded', () => {
  // Get references to DOM elements.  The `icon` triggers the page
  // transition when clicked.
  const canvas = document.getElementById('universe');
  // Attach the click listener to the entire icon container rather
  // than just the image.  This ensures the event fires even if the
  // image fails to load or the user clicks on the caption.
  const iconContainer = document.getElementById('icon-container');
  const introOverlay = document.getElementById('intro-overlay');

  // Create the Three.js renderer and attach it to our canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Set up a perspective camera.  We'll manipulate its position to
  // create a zoom effect when the user scrolls.
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000);
  // Start the camera at some distance so that stars fill the view.
  camera.position.z = 1000;

  // Create the scene and add an ambient light to brighten the stars.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Generate a star field.  We use BufferGeometry for efficiency and
  // randomise positions in a spherical volume around the origin.  The
  // sizeAttenuation property ensures stars look smaller as they move
  // further away.
  const starCount = 3000;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 2000 * Math.random();
    const phi = Math.random() * 2 * Math.PI;
    const costheta = Math.random() * 2 - 1;
    const theta = Math.acos(costheta);
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.sin(theta) * Math.sin(phi);
    const z = r * Math.cos(theta);
    starPositions[i * 3] = x;
    starPositions[i * 3 + 1] = y;
    starPositions[i * 3 + 2] = z;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: true });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // Variables used for parallax effect based on mouse movement.
  let targetX = 0;
  let targetY = 0;
  let mouseX = 0;
  let mouseY = 0;

  // Limit zoom positions.  We'll clamp the camera's z-coordinate
  // between these values when zooming via scroll.
  const minZoom = 500;
  const maxZoom = 2000;

  // Handle mouse movement for parallax.  We normalise the mouse
  // coordinates to the range [-0.5, 0.5] to create a gentle movement.
  function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) - 0.5;
    mouseY = (event.clientY / window.innerHeight) - 0.5;
  }
  window.addEventListener('mousemove', onMouseMove);

  // Handle scroll to zoom in and out.  We adjust the camera's z
  // position and clamp it within the specified bounds.
  function onWheel(event) {
    camera.position.z += event.deltaY * 0.5;
    camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z));
  }
  window.addEventListener('wheel', onWheel);

  // Handle window resizing.  It's important to update the camera's
  // aspect ratio and the renderer's size when the window size
  // changes.
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // Animate the scene.  We'll rotate the star field slowly and
  // interpolate the camera based on the mouse position for a smooth
  // parallax effect.
  function animate() {
    requestAnimationFrame(animate);
    // Slowly rotate the stars around the z-axis to create movement.
    stars.rotation.y += 0.0005;
    stars.rotation.x += 0.0002;
    // Interpolate camera position based on mouse movement for subtle parallax.
    targetX = mouseX * 50;
    targetY = mouseY * 50;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (-targetY - camera.position.y) * 0.05;
    // Always look at the centre of the scene.
    camera.lookAt(scene.position);
    renderer.render(scene, camera);
  }
  animate();

  // When the user clicks the start icon we play a small animation to
  // fade out the overlay elements and then navigate to the planets
  // page.  You can customise the duration and easing to taste.
  iconContainer.addEventListener('click', () => {
    // Remove event listeners to prevent further interaction.
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('wheel', onWheel);
    // Animate the icon and intro overlay out of view.
    gsap.to('#icon-container', { duration: 1, scale: 0.5, opacity: 0, ease: 'power2.inOut' });
    gsap.to('#intro-overlay', {
      duration: 1,
      opacity: 0,
      ease: 'power2.inOut',
      onComplete: () => {
        // Reveal the solar system container and initialise the
        // planetary system.  We remove the `hidden` class so the
        // solar system canvas becomes visible, then call the
        // initialization function defined in `planetScript.js`.  This
        // avoids navigating to a separate HTML file and keeps all
        // interactions on a single page.
        const solarContainer = document.getElementById('solar-container');
        solarContainer.classList.remove('hidden');
        if (typeof window.initSolarSystem === 'function') {
          window.initSolarSystem();
        }
      }
    });
  });
});
const iconContainer = document.getElementById('icon-container');
iconContainer.addEventListener('click', () => {
  gsap.to('#intro-overlay', {duration: 1, opacity: 0, ease: 'power2.inOut'});
  gsap.to('#icon-container', {duration: 1, scale: 0.5, opacity: 0, ease: 'power2.inOut', onComplete: () => {
    const solarContainer = document.getElementById('solar-container');
    solarContainer.classList.remove('hidden');
    if(typeof window.initSolarSystem === 'function'){
      window.initSolarSystem();
    }
  }});
});
