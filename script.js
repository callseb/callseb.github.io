/* entryHole.js — uses your crazy-4 tunnel as the entry background */
(function(){
  // canvas is inside the entry overlay
  const canvas = document.getElementById('entry-hole');
  if(!canvas){ console.warn('No #entry-hole canvas'); return; }

  let ww = window.innerWidth, wh = window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setSize(ww, wh);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 30, 150);

  const camera = new THREE.PerspectiveCamera(45, ww/wh, 0.1, 150);

  // ==== Build the tube path (from crazy-4) ====
  function getPoints(){
    const points = [];
    const r = 20;
    for(let i=0; i<100; i++){
      const a = i * 0.2; // spiral-ish
      const x = Math.cos(a) * (r + i*0.05);
      const y = Math.sin(a) * (r + i*0.05);
      const z = -i * 3;
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }

  const points = getPoints();
  const path = new THREE.CatmullRomCurve3(points); path.closed = false;

  const tubeDetail = 1400;   // divisions
  const circlesDetail = 40;  // circle precision
  const radius = 4;

  const frames = path.computeFrenetFrames(tubeDetail, false);
  const geometry = new THREE.Geometry();

  for (let i = 0; i < tubeDetail; i++) {
    const normal = frames.normals[i];
    const binorm = frames.binormals[i];
    const position = path.getPointAt(i / tubeDetail);

    for (let j = 0; j < circlesDetail; j++) {
      const v = (j / circlesDetail) * Math.PI * 2;
      const cx = -radius * Math.cos(v), cy = radius * Math.sin(v);

      const normalPoint = new THREE.Vector3();
      normalPoint.x = (cx * normal.x + cy * binorm.x);
      normalPoint.y = (cx * normal.y + cy * binorm.y);
      normalPoint.z = (cx * normal.z + cy * binorm.z);
      normalPoint.multiplyScalar(1);

      const p = new THREE.Vector3().copy(position).add(normalPoint);
      const color = new THREE.Color(`hsl(${(i / tubeDetail) * 360 * 4}, 100%, 55%)`);
      geometry.colors.push(color);
      geometry.vertices.push(p);
    }
  }

  const material = new THREE.PointsMaterial({ size: 0.20, vertexColors: THREE.VertexColors, transparent:true, opacity:0.95 });
  const tube = new THREE.Points(geometry, material);
  scene.add(tube);

  // animate camera flying down the tunnel
  let t = 0;
  function render(){
    t += 0.00065; // speed into hole
    const p1 = path.getPointAt(t % 1);
    const p2 = path.getPointAt((t + 0.01) % 1);
    camera.position.set(p1.x, p1.y, p1.z);
    camera.lookAt(p2);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  render();

  // Resize
  window.addEventListener('resize', () => {
    ww = window.innerWidth; wh = window.innerHeight;
    renderer.setSize(ww, wh);
    camera.aspect = ww/wh; camera.updateProjectionMatrix();
  });
})();
