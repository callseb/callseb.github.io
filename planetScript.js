window.initSolarSystem = function () {
  const solarCanvas = document.getElementById('solar-scene');

  // Scene & camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 50;

  const renderer = new THREE.WebGLRenderer({ canvas: solarCanvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // CSS2DRenderer for labels
  const labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  solarCanvas.parentNode.appendChild(labelRenderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(0, 0, 0);
  scene.add(pointLight);

  // Planet data
  const planetsData = [
    { name: 'Mercury', color: 0xaaa9ad, radius: 1, distance: 10, speed: 0.02, content: 'Mercury info here' },
    { name: 'Venus', color: 0xecc199, radius: 1.2, distance: 14, speed: 0.015, content: 'Venus info here' },
    { name: 'Earth', color: 0x2a5fff, radius: 1.5, distance: 18, speed: 0.012, content: 'Earth info here' },
    { name: 'Mars', color: 0xff3f3f, radius: 1.3, distance: 22, speed: 0.01, content: 'Mars info here' },
    { name: 'Jupiter', color: 0xffc07f, radius: 2.5, distance: 30, speed: 0.008, content: 'Jupiter info here' },
    { name: 'Saturn', color: 0xffe3a3, radius: 2.2, distance: 38, speed: 0.006, content: 'Saturn info here' },
    { name: 'Uranus', color: 0x7fffd4, radius: 1.8, distance: 46, speed: 0.005, content: 'Uranus info here' },
    { name: 'Neptune', color: 0x4169e1, radius: 1.7, distance: 54, speed: 0.004, content: 'Neptune info here' },
  ];

  const planets = [];

  // Create planets & labels
  planetsData.forEach((data) => {
    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({ color: data.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(data.distance, 0, 0);
    mesh.userData = { ...data };
    scene.add(mesh);
    planets.push(mesh);

    // Curved label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    labelDiv.innerHTML = `<p>${data.name}</p>`;
    const label = new THREE.CSS2DObject(labelDiv);
    label.position.set(0, data.radius + 1, 0);
    mesh.add(label);
  });

  // Sun
  const sunGeometry = new THREE.SphereGeometry(4, 32, 32);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd33 });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  // Raycaster for planet clicks
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const infoPanel = document.getElementById('info-panel');
  const planetTitle = document.getElementById('planet-title');
  const planetContent = document.getElementById('planet-content');
  const closeInfo = document.getElementById('close-info');

  function onPointerClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planets);
    if (intersects.length > 0) {
      const selected = intersects[0].object;
      planetTitle.textContent = selected.userData.name;
      planetContent.textContent = selected.userData.content;
      infoPanel.classList.remove('hidden');
    }
  }

  renderer.domElement.addEventListener('click', onPointerClick);

  closeInfo.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    planets.forEach((p) => {
      const angle = Date.now() * 0.001 * p.userData.speed;
      p.position.x = Math.cos(angle) * p.userData.distance;
      p.position.z = Math.sin(angle) * p.userData.distance;
    });
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  animate();

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });
};
