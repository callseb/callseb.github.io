import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { gsap } from 'https://cdn.skypack.dev/gsap@3.9.1';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene') });
renderer.setSize(window.innerWidth, window.innerHeight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1, 100);
pointLight.position.set(0, 3, 5);
scene.add(pointLight);

const ufoGeometry = new THREE.SphereGeometry(1, 32, 32);
const ufoMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const ufo = new THREE.Mesh(ufoGeometry, ufoMaterial);
ufo.position.set(0, 0, -5);
scene.add(ufo);

const alienGeometry = new THREE.SphereGeometry(0.25, 16, 16);
const alienMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const alien = new THREE.Mesh(alienGeometry, alienMaterial);
alien.position.set(0, 0.5, -5);
scene.add(alien);

function animate() {
  requestAnimationFrame(animate);
  ufo.rotation.x += 0.01;
  ufo.rotation.y += 0.01;
  alien.rotation.x += 0.01;
  alien.rotation.y += 0.01;
  renderer.render(scene, camera);
}

animate();

document.getElementById('ufo').addEventListener('click', () => {
  gsap.to('.alien-container', {
    scale: 0.5,
    opacity: 0,
    duration: 1,
    onComplete: () => {
      document.getElementById('solar-system').classList.remove('hidden');
      gsap.to('#solar-system', { top: '20%', duration: 2 });
    }
  });
});

document.querySelectorAll('.planet').forEach((planet) => {
  planet.addEventListener('click', () => {
    const planetName = planet.id;
    alert(`Welcome to ${planetName}!`);
  });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
