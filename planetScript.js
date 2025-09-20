/*
 * planetScript.js — scroll-to-lock under cursor + closer lock + detailed planets
 * Three.js r128 + GSAP 3.12+
 * Exposes:
 *   window.initSolarSystem()
 *   window.startWelcomeSequence()
 */

(function () {
  const TEX = "https://threejs.org/examples/textures/planets";
  const STAR_SPRITE = "https://threejs.org/examples/textures/sprites/disc.png";

  // ------------ helpers ------------
  function getOrCreateCanvas() {
    let canvas = document.getElementById("solar-scene") || document.getElementById("scene");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "solar-scene";
      Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", display: "block" });
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  // Stars: round sprites, closer & denser so they’re visible
  function makeStars({ count = 5200, rMin = 750, rMax = 1350, size = 1.8 } = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(rMin, rMax);
      const t = Math.acos(THREE.MathUtils.randFloatSpread(2));
      const p = Math.random() * Math.PI * 2;
      pos[i*3]   = r * Math.sin(t) * Math.cos(p);
      pos[i*3+1] = r * Math.cos(t);
      pos[i*3+2] = r * Math.sin(t) * Math.sin(p);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const sprite = new THREE.TextureLoader().load(STAR_SPRITE);
    const mat = new THREE.PointsMaterial({
      map: sprite, size, sizeAttenuation: true, color: 0xffffff,
      transparent: true, alphaTest: 0.45, depthWrite: false, opacity: 0.95
    });
    return new THREE.Points(geo, mat);
  }

  // Curved sprite label (used for hover)
  function makeCurvedLabel(text, diameterPx = 260) {
    const pad = 28, size = diameterPx + pad * 2;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0,0,size,size);
    ctx.translate(size/2, size/2);
    const radius = diameterPx/2;
    const chars = [...text];
    ctx.font = `700 28px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#ffeeb0";
    ctx.shadowColor = "rgba(255,200,80,.35)";
    ctx.shadowBlur = 14;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const arc = Math.PI * 0.92;
    const step = arc / Math.max(chars.length, 1);
    let ang = -arc/2;
    for (const ch of chars) {
      ctx.save(); ctx.rotate(ang); ctx.translate(0, -radius); ctx.rotate(-Math.PI/2);
      ctx.fillText(ch, 0, 0); ctx.restore();
      ang += step;
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 8;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  }

  // Detailed planet material: tries normal/bump/spec maps if available (fails gracefully)
  function makePlanetMaterial({ color=0x888888, map, normalMap, bumpMap, specularMap, bumpScale=0.2, metalness=0, roughness=1 }) {
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness });

    const set = (key, url, onload) => {
      if (!url) return;
      loader.load(url, (tx) => { mat[key] = tx; if (onload) onload(tx); mat.needsUpdate = true; }, undefined, () => {/* ignore */});
    };

    set("map", map, (tx)=>{ tx.anisotropy = 8; });
    set("normalMap", normalMap);
    set("bumpMap", bumpMap, ()=>{ mat.bumpScale = bumpScale; });
    set("roughnessMap", specularMap); // not perfect, but keeps highlights a bit tighter if provided

    return mat;
  }

  function buildSun() {
    const g = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const sunMat = new THREE.MeshBasicMaterial({
      map: loader.load(`${TEX}/sun.jpg`),
      emissive: 0xffaa33, emissiveIntensity: 0.7
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(18, 96, 96), sunMat);
    g.add(sphere);
    // halo
    const cvs = document.createElement("canvas"); cvs.width = cvs.height = 256;
    const c = cvs.getContext("2d"), grad = c.createRadialGradient(128,128,0,128,128,128);
    grad.addColorStop(0,"rgba(255,200,80,0.5)"); grad.addColorStop(1,"rgba(255,200,80,0.0)");
    c.fillStyle = grad; c.fillRect(0,0,256,256);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true, depthWrite: false }));
    glow.scale.set(90,90,1); g.add(glow);
    g.name = "Sun";
    return g;
  }

  // ------------ module state ------------
  let renderer, scene, camera;
  let planets = [], labels = [], sun;
  let raycaster, mouse, hovered = null;

  // focus/lock
  let focusTargets = [], focusIndex = 0;
  const lookAtTarget = new THREE.Vector3();
  const worldAbove = new THREE.Vector3();
  const screen = new THREE.Vector2();

  // HUD elements
  const $hint = () => document.getElementById("hint");
  const $skip = () => document.getElementById("tour-skip");
  const $card = () => document.getElementById("lock-card");
  const $title = () => document.getElementById("lock-title");
  const $sub = () => document.getElementById("lock-sub");

  // ------------ API: init ------------
  window.initSolarSystem = function initSolarSystem() {
    const canvas = getOrCreateCanvas();

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.add(makeStars());

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000);
    camera.position.set(0, 120, 420);

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const sunLight = new THREE.PointLight(0xffffff, 2.6, 0, 2);
    sunLight.position.set(0,0,0);
    scene.add(ambient, sunLight);

    // Sun
    sun = buildSun();
    scene.add(sun);

    // PLANETS — with detail maps where likely available (if a map 404s, it just falls back)
    const P = [
      {
        name:"Mercury",  size:2.4, orbit: 48, speed:0.010, url:"about.html",       label:"About",
        color:0x9c9c9c, map:`${TEX}/mercury.jpg`, normalMap:`${TEX}/mercury.jpg`, bumpMap:`${TEX}/mercury.jpg`, bumpScale:0.15
      },
      {
        name:"Venus",    size:3.6, orbit: 66, speed:0.008, url:"writing.html",     label:"Writing",
        color:0xd8b57a, map:`${TEX}/venus.jpg`, bumpMap:`${TEX}/venus.jpg`, bumpScale:0.08
      },
      {
        name:"Earth",    size:3.9, orbit: 88, speed:0.007, url:"projects.html",    label:"Projects",
        color:0xffffff, map:`${TEX}/earth_atmos_2048.jpg`, normalMap:`${TEX}/earth_normal_2048.jpg`,
        specularMap:`${TEX}/earth_specular_2048.jpg`, bumpMap:`${TEX}/earth_normal_2048.jpg`, bumpScale:0.25
      },
      {
        name:"Mars",     size:3.2, orbit:110, speed:0.006, url:"photography.html", label:"Photos",
        color:0xb55a3c, map:`${TEX}/mars_1k_color.jpg`, bumpMap:`${TEX}/mars_1k_color.jpg`, bumpScale:0.2
      },
      {
        name:"Jupiter",  size:8.8, orbit:150, speed:0.004, url:"resume.html",      label:"Resume",
        color:0xe0c7a2, map:`${TEX}/jupiter2_1024.jpg`
      },
      {
        name:"Saturn",   size:7.8, orbit:200, speed:0.004, url:"contact.html",     label:"Contact",
        color:0xdcc7a0, map:`${TEX}/saturn.jpg`, ring:true
      },
      {
        name:"Uranus",   size:6.2, orbit:250, speed:0.003, url:"links.html",       label:"Links",
        color:0x88e0e8, map:`${TEX}/uranus.jpg`
      },
      {
        name:"Neptune",  size:6.0, orbit:292, speed:0.003, url:"blog.html",        label:"Blog",
        color:0x4a6eff, map:`${TEX}/neptune.jpg`
      },
    ];

    // orbit lines
    P.forEach(p => {
      const segs = 256, pts = [];
      for (let i=0;i<=segs;i++){ const a=(i/segs)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit)); }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color:0x223344, transparent:true, opacity:0.35 });
      scene.add(new THREE.LineLoop(geo, mat));
    });

    // planets + labels
    planets = []; labels = [];
    const loader = new THREE.TextureLoader();

    P.forEach((cfg, i) => {
      const mat = makePlanetMaterial({
        color: cfg.color, map: cfg.map, normalMap: cfg.normalMap, bumpMap: cfg.bumpMap,
        specularMap: cfg.specularMap, bumpScale: cfg.bumpScale ?? 0.2, metalness: 0, roughness: 1
      });

      // more segments for crisper shading
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 96, 96), mat);
      mesh.userData = {
        name: cfg.name, url: cfg.url, label: cfg.label,
        orbit: cfg.orbit, speed: cfg.speed,
        angle: i * 0.85 + 0.3, baseRot: 0.003 + Math.random() * 0.004
      };
      mesh.position.set(Math.cos(mesh.userData.angle)*cfg.orbit, 0, Math.sin(mesh.userData.angle)*cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 260);
      sprite.scale.set(22, 11, 1);                // bigger labels
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 9, 0));
      sprite.material.opacity = 0;                // show on hover or when locked
      scene.add(sprite);
      labels.push(sprite);

      if (cfg.ring) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size*1.25, cfg.size*2.25, 96),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, color: 0xffffff })
        );
        loader.load(`${TEX}/saturnringcolor.jpg`, (t)=>{ ring.material.map=t; ring.material.needsUpdate=true; });
        loader.load(`${TEX}/saturnringpattern.gif`, (t)=>{ ring.material.alphaMap=t; ring.material.needsUpdate=true; });
        ring.rotation.x = -Math.PI/2;
        ring.position.copy(mesh.position);
        scene.add(ring);
        mesh.userData.ring = ring;
      }
    });

    // interactions
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);

    // scroll to lock (under cursor)
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", (e)=>{ if(e.key==="ArrowRight") stepFocus(1); if(e.key==="ArrowLeft") stepFocus(-1); });

    // focus list
    focusTargets = [buildSunProxy(sun), ...planets]; // Sun first (proxy gives geometry.radius)

    animate();
  };

  // Tiny proxy so Sun has a "radius" like planets for distance math
  function buildSunProxy(sunGroup){
    const proxy = new THREE.Object3D();
    proxy.position.copy(sunGroup.position);
    proxy.geometry = { parameters: { radius: 18 } };
    proxy.userData = { name: "Sun", label: "Home" };
    return proxy;
  }

  // ------------ welcome sequence ------------
  window.startWelcomeSequence = function startWelcomeSequence() {
    camera.position.set(0, 140, 520);
    camera.lookAt(0,0,0);
    const sb = $skip(); if (sb) sb.hidden = false;
    gsap.to(camera.position, { z: 440, duration: 1.2, ease: "power1.out" });
    const go = ()=>{ focusOn(1); if(sb){ sb.hidden=true; sb.onclick=null; } }; // Mercury
    if (sb) sb.onclick = go;
    gsap.delayedCall(1.4, go);
  };

  // ------------ focus/lock ------------
  function focusOn(index) {
    index = THREE.MathUtils.clamp(index, 0, focusTargets.length-1);
    focusIndex = index;
    const obj = focusTargets[focusIndex];

    // size-aware offset: bring camera in tighter for readable text
    const radius = obj.geometry?.parameters?.radius || 6;
    const dist   = radius * 3.8;   // was 5.5 → closer
    const height = radius * 1.6;
    const tpos   = obj.position.clone();
    const dest   = tpos.clone().add(new THREE.Vector3(0, height, dist));

    // update HUD card text + pop it in
    if ($title()) $title().textContent = obj.userData?.name || obj.name || "Planet";
    if ($sub())   $sub().textContent   = obj.userData?.label || (obj === focusTargets[0] ? "Home" : "");
    if ($card() && $card().hidden) {
      $card().hidden = false;
      gsap.fromTo($card(), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" });
    }

    // make on-planet sprite label visible while locked, others fade
    labels.forEach((s, i) => {
      const visible = (obj === planets[i]);
      gsap.to(s.material, { opacity: visible ? 1 : 0, duration: 0.2 });
    });

    gsap.to(camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.8, ease: "power2.out" });
    gsap.to(lookAtTarget,     { x: tpos.x, y: tpos.y, z: tpos.z, duration: 0.8, ease: "power2.out" });
  }

  // Step focus when using Arrow keys
  function stepFocus(dir){
    const next = THREE.MathUtils.clamp(focusIndex + dir, 0, focusTargets.length-1);
    focusOn(next);
  }

  // Mouse wheel: lock onto what you’re *pointing at*; if nothing, step
  let lastWheel = 0;
  function onWheel(e){
    const now = performance.now();
    if (now - lastWheel < 300) return; // debounced snap
    lastWheel = now;
    e.preventDefault();

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets, false);
    if (hits.length){
      const idx = planets.indexOf(hits[0].object);
      focusOn(idx + 1); // +1 because Sun proxy is index 0
    } else {
      stepFocus(e.deltaY > 0 ? 1 : -1);
    }
  }

  // ------------ pointer hover ------------
  function setLabelVisible(sprite, visible) {
    if (!sprite) return;
    const target = visible ? 1 : 0;
    if (sprite.material.opacity === target) return;
    gsap.to(sprite.material, { opacity: target, duration: 0.2, ease: "power2.out" });
  }

  function onPointerMove(e) {
    mouse.x =  (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets, false);

    if (hits.length) {
      const obj = hits[0].object;
      const idx = planets.indexOf(obj);
      setLabelVisible(labels[idx], true);
      if (hovered && hovered !== obj) setLabelVisible(labels[planets.indexOf(hovered)], false);
      hovered = obj;
      document.body.style.cursor = "pointer";
    } else {
      if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
      hovered = null;
      document.body.style.cursor = "default";
    }
  }

  // Click → open URL
  function onClick() {
    if (!hovered) return;
    const url = hovered.userData.url;
    if (url) window.location.href = url;
  }

  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ------------ animate ------------
  function animate(){
    requestAnimationFrame(animate);

    // gentle sun spin
    if (sun) sun.rotation.y += 0.002;

    planets.forEach((p, i) => {
      p.userData.angle += p.userData.speed;
      const r = p.userData.orbit;
      p.position.set(Math.cos(p.userData.angle)*r, 0, Math.sin(p.userData.angle)*r);
      p.rotation.y += p.userData.baseRot;

      // keep ring + label with planet
      if (p.userData.ring) p.userData.ring.position.copy(p.position);
      const s = labels[i];
      if (s){
        const h = (p.geometry.parameters.radius || 1) + 9;
        s.position.set(p.position.x, p.position.y + h, p.position.z);
        s.lookAt(camera.position);
      }
    });

    // aim camera at target of interest
    camera.lookAt(lookAtTarget);

    // position HTML lock card above focused target in screen space
    if ($card() && !$card().hidden && focusTargets.length){
      const obj = focusTargets[focusIndex];
      const radius = obj.geometry?.parameters?.radius || 6;
      worldAbove.copy(obj.position).add(new THREE.Vector3(0, radius + 12, 0)); // higher = more readable
      worldAbove.project(camera);
      screen.x = (worldAbove.x * 0.5 + 0.5) * window.innerWidth;
      screen.y = (-worldAbove.y * 0.5 + 0.5) * window.innerHeight;
      $card().style.left = `${screen.x}px`;
      $card().style.top  = `${screen.y}px`;
    }

    renderer.render(scene, camera);
  }

  // ------------ bootstrap hint ------------
  document.addEventListener("DOMContentLoaded", ()=> {
    const hint = document.getElementById("hint");
    if (hint) gsap.to(hint, { opacity: 1, delay: 1.2, duration: .6 });
  });

})();
