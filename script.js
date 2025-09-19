window.addEventListener('DOMContentLoaded', () => {
  const sceneContainer = document.getElementById('scene-container');
  const universeCanvas = document.getElementById('universe');

  // THREE.js scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 20;

  const renderer = new THREE.WebGLRenderer({ canvas: universeCanvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Star field
  const starsGeometry = new THREE.BufferGeometry();
  const starsCount = 10000;
  const starsPositions = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i++) {
    starsPositions[i] = (Math.random() - 0.5) * 500;
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 });
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // UFO sprite
  const ufoTexture = new THREE.TextureLoader().load('assets/ufo-icon.png');
  const ufoMaterial = new THREE.SpriteMaterial({ map: ufoTexture, color: 0xffffff });
  const ufo = new THREE.Sprite(ufoMaterial);
  ufo.scale.set(5, 5, 1); // larger
  ufo.position.set(0, 5, 0);
  scene.add(ufo);

  // UFO hover animation
  gsap.to(ufo.position, {
    y: '+=1',
    duration: 1.5,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });

  // Animate stars
  function animate() {
    requestAnimationFrame(animate);
    stars.rotation.y += 0.0005;
    renderer.render(scene, camera);
  }
  animate();

  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // UFO click -> show solar system
  const iconContainer =
