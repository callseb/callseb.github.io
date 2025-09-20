/* entryBlackhole.js
 * - Entry black hole (uses your crazy4-wormhole.js if present, else fallback)
 * - UFO flies a bezier, shrinks, leaves smoke, disappears into hole
 * - Fades to main solar system, then triggers overview → lock
 */

(function(){
  const entryCanvas = document.getElementById('entry-scene');
  const entryLayer  = document.getElementById('entry-layer');
  const skipBtn     = document.getElementById('entry-skip');

  let renderer, scene, camera, clock;
  let ufo, smokePool = [], smokeIdx = 0;
  let t = 0; // 0..1 over the curve
  let running = true;

  function initEntry(){
    renderer = new THREE.WebGLRenderer({ canvas: entryCanvas, antialias:true, alpha:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 6000);
    camera.position.set(0, 18, 70);

    clock = new THREE.Clock();

    // --- Wormhole: use your adapter if present, else fallback
    if (typeof window.createWormhole === 'function') {
      try { window.createWormhole(scene, camera, renderer); }
      catch(e){ console.warn('custom wormhole failed, using fallback', e); buildFallbackHole(); }
    } else {
      buildFallbackHole();
    }

    // --- UFO (simple, stylised)
    ufo = buildUFO();
    ufo.position.set(-40, 12, 40);
    scene.add(ufo);

    // smoke sprites (pool)
    makeSmokePool(120);

    // controls: skip
    skipBtn.addEventListener('click', endEntry);

    // resize
    window.addEventListener('resize', onResize);

    // start
    animate();
  }

  function buildFallbackHole(){
    // vortex disk (shader swirl)
    const g = new THREE.RingGeometry(2.0, 14.0, 256, 1);
    const m = new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, side:THREE.DoubleSide,
      uniforms:{
        uTime:{value:0}, uInner:{value:2.0}, uOuter:{value:14.0},
        uTint:{value:new THREE.Color(0x88e0ff)}
      },
      vertexShader:`
        varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 pos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
        }
      `,
      fragmentShader:`
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uTint;
        void main(){
          // radial coords
          vec2 uv = vUv - 0.5;
          float r = length(uv)*2.0;
          float a = atan(uv.y, uv.x);
          // swirl
          a += (1.2 / (r+0.15)) * (uTime*0.7);
          float ring = smoothstep(0.0,0.05,abs(sin(a*6.0))* (1.0-r) );
          float glow = smoothstep(1.2,0.0,r);
          float alpha = clamp(ring*0.9 + glow*0.35, 0.0, 1.0);
          vec3 col = mix(vec3(0.02,0.03,0.06), uTint, ring*0.9 + glow*0.2);
          gl_FragColor = vec4(col, alpha*0.9);
        }
      `
    });
    const disk = new THREE.Mesh(g,m);
    disk.rotation.x = -Math.PI/2;
    scene.add(disk);

    // singularity (dark sphere)
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 48, 48),
      new THREE.MeshBasicMaterial({ color:0x000000 })
    );
    s.position.y = -0.05;
    scene.add(s);

    // subtle accent ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(14.0, 14.6, 256),
      new THREE.MeshBasicMaterial({ color:0x1b2a44, transparent:true, opacity:.35, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI/2;
    scene.add(ring);

    // animate time uniform
    scene.userData.updateWormhole = (sec)=>{ m.uniforms.uTime.value = sec; };
  }

  function buildUFO(){
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 2.2, 0.55, 36),
      new THREE.MeshStandardMaterial({ color:0xbec6d1, roughness:.4, metalness:.6 })
    );
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 36, 24),
      new THREE.MeshStandardMaterial({ color:0xbfefff, roughness:.2, metalness:.1, emissive:0x66ccff, emissiveIntensity:.2 })
    );
    dome.scale.set(1,.65,1); dome.position.y = .5;
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, .08, 12, 48),
      new THREE.MeshStandardMaterial({ color:0xf0f5ff, roughness:.25, metalness:.7 })
    );
    tor.rotation.x = Math.PI/2;

    g.add(hull, dome, tor);

    // windows
    const wMat = new THREE.MeshStandardMaterial({ color:0xffe36d, emissive:0xffe36d, emissiveIntensity:.9 });
    for(let i=0;i<5;i++){
      const w = new THREE.Mesh(new THREE.CircleGeometry(.13, 18), wMat);
      const a = i*(Math.PI*2/5);
      w.position.set(Math.cos(a)*1.8, .08, Math.sin(a)*1.8);
      w.rotation.x = -Math.PI/2;
      g.add(w);
    }

    // subtle light
    const a = new THREE.AmbientLight(0xffffff, .35);
    const p = new THREE.PointLight(0xffffff, 1.3, 12, 2);
    p.position.set(0,1,0);
    g.add(a,p);

    return g;
  }

  function makeSmokePool(n){
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 128;
    const ctx = cvs.getContext('2d');
    const grad = ctx.createRadialGradient(64,64,1, 64,64,64);
    grad.addColorStop(0, 'rgba(200,220,255,0.35)');
    grad.addColorStop(1, 'rgba(200,220,255,0.0)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,128,128);
    const tex = new THREE.CanvasTexture(cvs);
    for(let i=0;i<n;i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, opacity:0 }));
      s.scale.set(1.8,1.8,1);
      scene.add(s);
      smokePool.push(s);
    }
  }

  function spawnSmoke(pos){
    const s = smokePool[smokeIdx++ % smokePool.length];
    s.position.copy(pos);
    s.material.opacity = .55;
    s.scale.set(0.8,0.8,1);
    gsap.to(s.material, { opacity:0, duration:1.2, ease:'power2.out' });
    gsap.to(s.scale, { x:2.6, y:2.6, duration:1.2, ease:'power2.out' });
  }

  function ufoPathPoint(k){
    // cubic bezier from start(-40,12,40) to hole(0,0,0)
    const p0 = new THREE.Vector3(-40, 12, 40);
    const p1 = new THREE.Vector3(-10, 22, 10);
    const p2 = new THREE.Vector3(  8,  8,  4);
    const p3 = new THREE.Vector3(  0,  0,  0);
    // de Casteljau
    const a = p0.clone().lerp(p1,k);
    const b = p1.clone().lerp(p2,k);
    const c = p2.clone().lerp(p3,k);
    const d = a.clone().lerp(b,k);
    const e = b.clone().lerp(c,k);
    return d.lerp(e,k);
  }

  function animate(){
    if (!running) return;
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const sec = clock.elapsedTime;

    // wormhole update
    if (scene.userData.updateWormhole) scene.userData.updateWormhole(sec);

    // UFO glide → shrink → vanish
    t = Math.min(1, t + dt*0.26); // slower, dreamy
    const pos = ufoPathPoint(t);
    ufo.position.copy(pos);
    ufo.rotation.y += 0.02;
    const s = THREE.MathUtils.lerp(1, 0.02, Math.pow(t,1.6));
    ufo.scale.setScalar(s);

    // smoke every few frames
    if ((sec*60|0)%2===0) spawnSmoke(pos.clone().add(new THREE.Vector3(0,.2,0)));

    // slight camera drift for parallax
    camera.position.x = Math.sin(sec*0.25)*2.5;
    camera.lookAt(0,0,0);

    renderer.render(scene, camera);

    if (t>=1){
      endEntry();
    }
  }

  function endEntry(){
    if (!running) return;
    running = false;
    // quick fade and handoff
    entryLayer.style.opacity = '0';
    setTimeout(()=>{
      entryLayer.style.display = 'none';
      // boot main scene
      if (window.initSolarSystem) window.initSolarSystem();
      const hint = document.getElementById('hint');
      if (hint) gsap.to(hint, { opacity: 1, delay: 1.0, duration: .6 });
      if (window.startWelcomeSequence) window.startWelcomeSequence(); // overview → lock
    }, 580);
  }

  function onResize(){
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // kick it
  document.addEventListener('DOMContentLoaded', initEntry);
})();
