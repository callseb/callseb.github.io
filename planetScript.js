/*
 * planetScript.js — uses your StarsBackground, fixes Sun + Saturn rings,
 * scroll-to-lock under cursor, close/readable lock card.
 * Three.js r128 + GSAP 3.12+
 *
 * Exposes:
 *   window.initSolarSystem()
 *   window.startWelcomeSequence()
 */
(function () {
  const TEX = "https://threejs.org/examples/textures/planets";

  // ---------- helpers ----------
  function getOrCreateCanvas() {
    let canvas = document.getElementById("solar-scene") || document.getElementById("scene");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "solar-scene";
      Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", display: "block", zIndex: 10 });
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  // curved sprite label (bigger, readable)
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

  // detailed materials with graceful fallbacks
  function makePlanetMaterial(opts) {
    const {
      color=0x888888, map, normalMap, bumpMap, specularMap,
      bumpScale=0.2, metalness=0, roughness=1
    } = opts || {};
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness });

    const set = (key, url, onload) => {
      if (!url) return;
      loader.load(url, (tx) => {
        // sRGB for color maps
        if (key === "map") tx.encoding = THREE.sRGBEncoding;
        mat[key] = tx;
        if (onload) onload(tx);
        mat.needsUpdate = true;
      }, undefined, () => {/* ignore failures, keep fallback */});
    };

    set("map", map, (tx)=>{ tx.anisotropy = 8; });
    set("normalMap", normalMap);
    set("bumpMap", bumpMap, ()=>{ mat.bumpScale = bumpScale; });
    set("roughnessMap", specularMap);

    return mat;
  }

  // detailed Sun with texture, emissive + halo (and a color fallback so it never looks black)
  function buildSun() {
    const g = new THREE.Group();
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffcc55, // fallback color so it’s never black
      emissive: 0xffa733, emissiveIntensity: 0.7
    });

    loader.load(`${TEX}/sun.jpg`, (tx) => {
      tx.encoding = THREE.sRGBEncoding;
      sunMat.map = tx;
      sunMat.needsUpdate = true;
    });

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(18, 96, 96), sunMat);
    g.add(sphere);

    // soft halo
    const cvs = document.createElement("canvas"); cvs.width = cvs.height = 256;
    const c = cvs.getContext("2d"), grad = c.createRadialGradient(128,128,0,128,128,128);
    grad.addColorStop(0,"rgba(255,200,80,0.5)"); grad.addColorStop(1,"rgba(255,200,80,0.0)");
    c.fillStyle = grad; c.fillRect(0,0,256,256);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true, depthWrite: false }));
    glow.scale.set(90,90,1); g.add(glow);

    g.name = "Sun";
    return g;
  }

  // ---------- module state ----------
  let renderer, scene, camera;
  let planets = [], labels = [], sun;
  let raycaster, mouse, hovered = null;

  // focus/lock
  let focusTargets = [], focusIndex = 0;
  const lookAtTarget = new THREE.Vector3();
  const worldAbove = new THREE.Vector3();
  const screen = new THREE.Vector2();

  // HUD elements
  const $skip  = () => document.getElementById("tour-skip");
  const $card  = () => document.getElementById("lock-card");
  const $title = () => document.getElementById("lock-title");
  const $sub   = () => document.getElementById("lock-sub");

  // ---------- API: init ----------
  window.initSolarSystem = function initSolarSystem() {
    const canvas = getOrCreateCanvas();

    // IMPORTANT: alpha true so your React StarsBackground shows through
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    // Do NOT set scene.background — keep it transparent for your StarsBackground

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

    // PLANETS (more detail; rings will be parented to Saturn)
    const P = [
      {
        name:"Mercury",  size:2.4, orbit: 48, speed:0.010, url:"about.html",       label:"About",
        color:0x9c9c9c, map:`${TEX}/mercury.jpg`, bumpMap:`${TEX}/mercury.jpg`, bumpScale:0.15
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
    loader.setCrossOrigin('anonymous');

    P.forEach((cfg, i) => {
      const mat = makePlanetMaterial({
        color: cfg.color, map: cfg.map, normalMap: cfg.normalMap, bumpMap: cfg.bumpMap,
        specularMap: cfg.specularMap, bumpScale: cfg.bumpScale ?? 0.2, metalness: 0, roughness: 1
      });

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
      sprite.scale.set(22, 11, 1);
      sprite.position.set(0, cfg.size + 9, 0); // will attach as child (so it follows while focused)
      sprite.material.opacity = 0;
      mesh.add(sprite);         // <— attach label to the planet itself
      labels.push(sprite);

      // SATURN RINGS — parent to Saturn so they always stick
      if (cfg.ring) {
        const inner = cfg.size*1.25, outer = cfg.size*2.25;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(inner, outer, 96),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, color: 0xffffff })
        );
        ring.rotation.x = -Math.PI/2;
        ring.position.set(0, 0, 0);
        loader.load(`${TEX}/saturnringcolor.jpg`, (t)=>{ ring.material.map=t; ring.material.needsUpdate=true; });
        loader.load(`${TEX}/saturnringpattern.gif`, (t)=>{ ring.material.alphaMap=t; ring.material.needsUpdate=true; });
        mesh.add(ring);         // <— parented to Saturn mesh
        mesh.userData.ring = ring;
      }
    });

    // interactions
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", (e)=>{ if(e.key==="ArrowRight") stepFocus(1); if(e.key==="ArrowLeft") stepFocus(-1); });

    // focus list (Sun first, then planets)
    focusTargets = [buildSunProxy(sun), ...planets];

    animate();
  };

  // give Sun a "geometry.parameters.radius" like planets for distance math
  function buildSunProxy(sunGroup){
    const proxy = new THREE.Object3D();
    proxy.position.copy(sunGroup.position);
    proxy.geometry = { parameters: { radius: 18 } };
    proxy.userData = { name: "Sun", label: "Home" };
    return proxy;
  }

  // ---------- welcome sequence ----------
  window.startWelcomeSequence = function startWelcomeSequence() {
    camera.position.set(0, 140, 520);
    camera.lookAt(0,0,0);
    const sb = $skip(); if (sb) sb.hidden = false;
    gsap.to(camera.position, { z: 440, duration: 1.2, ease: "power1.out" });
    const go = ()=>{ focusOn(1); if(sb){ sb.hidden=true; sb.onclick=null; } };
    if (sb) sb.onclick = go;
    gsap.delayedCall(1.4, go);
  };

  // ---------- lock/focus ----------
  let focusIndex = 0;
  const lookAtTarget = new THREE.Vector3();
  function focusOn(index) {
    index = THREE.MathUtils.clamp(index, 0, focusTargets.length-1);
    focusIndex = index;
    const obj = focusTargets[focusIndex];

    const radius = obj.geometry?.parameters?.radius || 6;
    const dist   = radius * 3.6;   // nice and close
    const height = radius * 1.6;

    const tpos = obj.position.clone();
    const dest = tpos.clone().add(new THREE.Vector3(0, height, dist));

    // update on-screen HUD
    if ($title()) $title().textContent = obj.userData?.name || obj.name || "Planet";
    if ($sub())   $sub().textContent   = obj.userData?.label || (obj === focusTargets[0] ? "Home" : "");
    if ($card() && $card().hidden) {
      $card().hidden = false;
      gsap.fromTo($card(), { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" });
    }

    // show only the focused planet's curved label
    labels.forEach((s, i) => {
      const visible = (obj === planets[i]);
      gsap.to(s.material, { opacity: visible ? 1 : 0, duration: 0.18 });
    });

    gsap.to(camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.8, ease: "power2.out" });
    gsap.to(lookAtTarget,     { x: tpos.x, y: tpos.y, z: tpos.z, duration: 0.8, ease: "power2.out" });
  }

  function stepFocus(dir){
    const next = THREE.MathUtils.clamp(focusIndex + dir, 0, focusTargets.length-1);
    focusOn(next);
  }

  // scroll: lock the planet under the cursor (if any); otherwise step
  let lastWheel = 0;
  function onWheel(e){
    const now = performance.now();
    if (now - lastWheel < 280) return; // snappy debounce
    lastWheel = now;
    e.preventDefault();

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets, false);
    if (hits.length){
      const idx = planets.indexOf(hits[0].object);
      focusOn(idx + 1); // +1: Sun proxy is index 0
    } else {
      stepFocus(e.deltaY > 0 ? 1 : -1);
    }
  }

  // ---------- hover + click ----------
  function onPointerMove(e) {
    mouse.x =  (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets, false);

    if (hits.length) {
      const obj = hits[0].object;
      const idx = planets.indexOf(obj);
      // we keep labels hidden unless focused; hover doesn't force-show anymore
      hovered = obj;
      document.body.style.cursor = "pointer";
    } else {
      hovered = null;
      document.body.style.cursor = "default";
    }
  }

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

  // ---------- animate ----------
  function animate(){
    requestAnimationFrame(animate);

    if (sun) sun.rotation.y += 0.002;

    planets.forEach((p) => {
      p.userData.angle += p.userData.speed;
      const r = p.userData.orbit;
      p.position.set(Math.cos(p.userData.angle)*r, 0, Math.sin(p.userData.angle)*r);
      p.rotation.y += p.userData.baseRot;
      // rings & labels are children now, so they follow automatically
    });

    camera.lookAt(lookAtTarget);

    // keep the HTML lock card above the focused object
    const card = $card();
    if (card && !card.hidden && focusTargets.length){
      const obj = focusTargets[focusIndex];
      const radius = obj.geometry?.parameters?.radius || 6;
      worldAbove.copy(obj.position).add(new THREE.Vector3(0, radius + 12, 0));
      worldAbove.project(camera);
      screen.x = (worldAbove.x * 0.5 + 0.5) * window.innerWidth;
      screen.y = (-worldAbove.y * 0.5 + 0.5) * window.innerHeight;
      card.style.left = `${screen.x}px`;
      card.style.top  = `${screen.y}px`;
    }

    renderer.render(scene, camera);
  }

})();
