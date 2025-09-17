/*
 * Solar system module
 *
 * This script defines a single function, `initSolarSystem()`, on the
 * global `window` object.  When called, it builds a miniature
 * solar system inside a canvas on the page.  Planets orbit a
 * central sun and can be clicked to reveal information in a
 * sliding panel.  Zoom with the mouse wheel and gently rotate
 * the camera with the mouse for an immersive experience.
 *
 * To use this module, include it in your HTML and call
 * `initSolarSystem()` after the DOM has loaded.  In the landing
 * page, we call this function once the user clicks the UFO icon
 * and the overlay is hidden.  See `script.js` for how this is
 * integrated.
 */

window.initSolarSystem = function initSolarSystem() {
  // Prevent double initialisation.  If the solar system has
  // already been created, simply return.  We store a flag on
  // the canvas element to remember whether the system is ready.
  const canvas = document.getElementById('solar-scene');
  if (!canvas || canvas.dataset.initialised) {
    return;
  }
  canvas.dataset.initialised = 'true';

  // Get references to the info panel elements.  These are
  // defined in the HTML (index.html) so they can be reused
  // without duplication.
  const infoPanel = document.getElementById('info-panel');
  const closeBtn = document.getElementById('close-info');
  const titleEl = document.getElementById('planet-title');
  const contentEl = document.getElementById('planet-content');

  // Create the Three.js renderer.  Attach it to the canvas and
  // ensure high DPI support by setting the pixel ratio.  We
  // enable antialiasing for smoother edges.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Perspective camera for the planetary system.  Adjust the
  // field of view and clipping planes to achieve a balanced
  // perspective.  We position the camera above and behind the
  // scene so the orbits are easily visible.
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(0, 200, 800);
  camera.lookAt(0, 0, 0);

  // Create the scene and set a dark background so stars stand out.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Ambient light softly illuminates all objects.  A point light at
  // the centre acts like the sun, casting highlights on the planets.
  const ambient = new THREE.AmbientLight(0x555555);
  scene.add(ambient);
  const pointLight = new THREE.PointLight(0xffffff, 2, 0);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);

  // Generate a star field for the background.  We use a
  // BufferGeometry and randomly distribute points on a large
  // sphere.  Stars are static on this page.
  const starCount = 2000;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 4000 * Math.random();
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = Math.random() * 2 * Math.PI;
    starPositions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
    starPositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
    starPositions[i * 3 + 2] = r * Math.cos(theta);
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true });
  const starField = new THREE.Points(starGeometry, starMaterial);
  scene.add(starField);

  // Create the sun.  We use a MeshBasicMaterial because the sun
  // emits its own light and should not be affected by external
  // lighting.  A warm orange hue gives it a psychedelic glow.
  const sunGeometry = new THREE.SphereGeometry(40, 32, 32);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  // Define the planets with their properties.  Each entry
  // specifies the name, distance from the sun (orbitalRadius),
  // planet size, orbital speed, colour and the text content to
  // display when clicked.  Feel free to customise these values or
  // add more planets.  You can also include images or icons by
  // modifying the `content` property and rendering inside
  // `icon-slot`.
  const planetsData = [
    {
      name: 'Earth',
      orbitalRadius: 150,
      size: 15,
      speed: 0.01,
      color: 0x4cafef,
      content: 'This could be your ABOUT section. Tell visitors who you are or describe your craft here.'
    },
    {
      name: 'Mars',
      orbitalRadius: 220,
      size: 12,
      speed: 0.008,
      color: 0xeb5b35,
      content: 'Share some of your stories here. Perhaps tales of your adventures or short stories you’ve written.'
    },
    {
      name: 'Venus',
      orbitalRadius: 270,
      size: 10,
      speed: 0.006,
      color: 0xf4b400,
      content: 'Display your poems or creative writing pieces on this planet.'
    },
    {
      name: 'Jupiter',
      orbitalRadius: 330,
      size: 25,
      speed: 0.004,
      color: 0xd59f54,
      content: 'Use this space for a portfolio of photographs or graphic design works. You can embed images in the panel.'
    },
    {
      name: 'Saturn',
      orbitalRadius: 400,
      size: 20,
      speed: 0.003,
      color: 0x98d263,
      content: 'A miscellaneous section—perhaps news, blog posts or anything else you want to share.'
    }
  ];

  // We'll store planet meshes to update their positions and detect
  // clicks.  Each mesh stores its orbital parameters and text.
  const planets = [];
  planetsData.forEach(data => {
    // Planet sphere
    const geometry = new THREE.SphereGeometry(data.size, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: data.color });
    const planetMesh = new THREE.Mesh(geometry, material);
    planetMesh.userData = {
      name: data.name,
      content: data.content,
      orbitalRadius: data.orbitalRadius,
      speed: data.speed,
      angle: Math.random() * Math.PI * 2
    };
    scene.add(planetMesh);
    planets.push(planetMesh);
    // Orbit ring for visual reference
    const ringGeo = new THREE.RingGeometry(data.orbitalRadius - 0.2, data.orbitalRadius + 0.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  });

  // Raycaster to detect clicks on planets.  We convert mouse
  // coordinates into normalised device coordinates before casting.
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onCanvasClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planets);
    if (intersects.length > 0) {
      const selected = intersects[0].object;
      titleEl.textContent = selected.userData.name;
      contentEl.textContent = selected.userData.content;
      infoPanel.classList.remove('hidden');
      infoPanel.classList.add('show');
    }
  }
  renderer.domElement.addEventListener('click', onCanvasClick);

  // Close the panel when the close button is clicked
  closeBtn.addEventListener('click', () => {
    infoPanel.classList.remove('show');
    setTimeout(() => {
      infoPanel.classList.add('hidden');
    }, 500);
  });

  // Zoom handling via scroll.  We clamp the camera distance to
  // avoid clipping into the planets or pulling too far away.
  const minZoom = 300;
  const maxZoom = 1500;
  function onWheel(event) {
    camera.position.z += event.deltaY * 0.5;
    camera.position.z = Math.max(minZoom, Math.min(maxZoom, camera.position.z));
  }
  window.addEventListener('wheel', onWheel);

  // Adjust renderer and camera on window resize.
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // Optional: subtle camera rotation based on mouse movement for
  // parallax.  Normalise mouse position and ease the camera.
  let mouseX = 0;
  let mouseY = 0;
  function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) - 0.5;
    mouseY = (event.clientY / window.innerHeight) - 0.5;
  }
  window.addEventListener('mousemove', onMouseMove);

  // Animation loop.  Update orbital positions and camera.
  function animate() {
    requestAnimationFrame(animate);
    planets.forEach(planet => {
      planet.userData.angle += planet.userData.speed;
      const a = planet.userData.angle;
      const r = planet.userData.orbitalRadius;
      planet.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      planet.rotation.y += 0.01;
    });
    camera.position.x += (mouseX * 200 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 100 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  animate();
};