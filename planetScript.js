/*
 * planetScript.js — UFO core, far-star shell, spaced planets, locked scroll tour
 * Requires Three.js + GSAP. Exposes window.initSolarSystem().
 */

(function () {
  const TEX = "https://threejs.org/examples/textures/planets";
  const STAR_SPRITE = "https://threejs.org/examples/textures/sprites/disc.png";

  // ---------- DOM helpers ----------
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

  function makeHUD() {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      left: "14px",
      top: "14px",
      padding: ".4rem .6rem",
      font: "600 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      color: "#e9ffe0",
      border: "1px solid rgba(255,255,255,.09)",
      borderRadius: "8px",
      background: "rgba(10,12,18,.35)",
      backdropFilter: "blur(6px)",
      zIndex: 2,
      pointerEvents: "none",
      opacity: 0
    });
    document.body.appendChild(el);
    return el;
  }

  // ---------- Curved label (canvas → sprite) ----------
  function makeCurvedLabel(text, diameterPx = 180) {
    const pad = 24, size = diameterPx + pad * 2;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);

    const radius = diameterPx / 2;
    const chars = [...text];
    const fontSize = 26;
    ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#e9ffd0";
    ctx.shadowColor = "rgba(180,255,120,.28)";
    ctx.shadowBlur = 8;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const arc = Math.PI * 0.9;
    const step = arc / Math.max(chars.length, 1);
    let angle = -arc / 2;
    for (const ch of chars) {
      ctx.save();
      ctx.rotate(angle);
      ctx.translate(0, -radius);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      angle += step;
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 8;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
    return new THREE.Sprite(mat);
  }

  // ---------- Stars: far spherical shell (no near flybys) ----------
  function makeStars({ count = 4500, rMin = 1200, rMax = 2200 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(rMin, rMax);
      const theta = Math.acos(THREE.MathUtils.randFloatSpread(2));
      const phi = Math.random() * Math.PI * 2;
      positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const tex = new THREE.TextureLoader().load(STAR_SPRITE);
    const mat = new THREE.PointsMaterial({
      map: tex, size: 1.6, sizeAttenuation: true,
      color: 0xffffff, transparent: true, alphaTest: 0.4, depthWrite: false, opacity: 0.95
    });
    return new THREE.Points(geo, mat);
  }

  // ---------- Planet material with texture fallback ----------
  function makePlanetMaterial(url, fallbackColor = 0x888888) {
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 1, metalness: 0 });
    loader.load(url, (tx) => { mat.map = tx; mat.needsUpdate = true; });
    return mat;
  }

  // ---------- 3D UFO to replace the sun ----------
  function buildUFO() {
    const g = new THREE.Group();

    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 4.0, 0.9, 48),
      new THREE.MeshStandardMaterial({ color: 0xaeb6c1, roughness: 0.4, metalness: 0.6 })
    );
    hull.rotation.x = 0;
    g.add(hull);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0xbfefff, roughness: 0.15, metalness: 0.1, emissive: 0x66ccff, emissiveIntensity: 0.15 })
    );
    dome.scale.set(1, 0.65, 1);
    dome.position.y = 0.95;
    g.add(dome);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(4.3, 0.18, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.25, metalness: 0.7 })
    );
    rim.rotation.x = Math.PI / 2;
    g.add(rim);

    // little windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0xffe36d, emissive: 0xffe36d, emissiveIntensity: 0.8 });
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), winMat);
      const a = i * (Math.PI * 2 / 5);
      w.position.set(Math.cos(a) * 3.25, 0.15, Math.sin(a) * 3.25);
      w.rotation.x = -Math.PI / 2;
      g.add(w);
    }

    // soft glow sprite
    const glowCvs = document.createElement("canvas");
    glowCvs.width = glowCvs.height = 256;
    const ctx = glowCvs.getContext("2d");
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(0,255,180,0.35)");
    grad.addColorStop(1, "rgba(0,255,160,0.0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCvs), transparent: true, depthWrite: false }));
    glow.scale.set(16, 16, 1);
    glow.position.y = -0.4;
    g.add(glow);

    g.name = "UFO";
    return g;
  }

  window.initSolarSystem = function initSolarSystem() {
    const canvas = getOrCreateCanvas();
    const hud = makeHUD();

    // renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.add(makeStars()); // far shell

    // camera (zoomed out a bit more)
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000);
    camera.position.set(0, 90, 360);

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const coreLight = new THREE.PointLight(0xffffff, 2.2, 0, 2);
    coreLight.position.set(0, 0, 0);
    scene.add(ambient, coreLight);

    // center “sun” → **UFO**
    const ufo = buildUFO();
    scene.add(ufo);

    // planet config — **more spaced out**
    const PLANETS = [
      { name: "Mercury", tex: `${TEX}/mercury.jpg`,              color: 0x9c9c9c, size: 2.2, orbit: 38,  speed: 0.020, url: "about.html",        label: "About" },
      { name: "Venus",   tex: `${TEX}/venus.jpg`,                color: 0xd8b57a, size: 3.5, orbit: 54,  speed: 0.016, url: "writing.html",      label: "Writing" },
      { name: "Earth",   tex: `${TEX}/earth_atmos_2048.jpg`,     color: 0x5aa0ff, size: 3.7, orbit: 72,  speed: 0.014, url: "projects.html",     label: "Projects" },
      { name: "Mars",    tex: `${TEX}/mars_1k_color.jpg`,        color: 0xb55a3c, size: 3.0, orbit: 92,  speed: 0.012, url: "photography.html",  label: "Photos" },
      { name: "Jupiter", tex: `${TEX}/jupiter2_1024.jpg`,        color: 0xe0c7a2, size: 8.5, orbit: 128, speed: 0.009, url: "resume.html",       label: "Resume" },
      { name: "Saturn",  tex: `${TEX}/saturn.jpg`,               color: 0xdcc7a0, size: 7.5, orbit: 168, speed: 0.008, url: "contact.html",      label: "Contact" },
      { name: "Uranus",  tex: `${TEX}/uranus.jpg`,               color: 0x88e0e8, size: 6.0, orbit: 204, speed: 0.007, url: "links.html",        label: "Links" },
      { name: "Neptune", tex: `${TEX}/neptune.jpg`,              color: 0x4a6eff, size: 5.8, orbit: 238, speed: 0.006, url: "blog.html",         label: "Blog" },
    ];

    const planets = [];
    const labels  = [];
    const rings   = [];

    // orbit lines (design: thin, subtle)
    function addOrbit(radius) {
      const segs = 256;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x223344, transparent: true, opacity: 0.35 });
      const loop = new THREE.LineLoop(geo, mat);
      scene.add(loop);
    }

    PLANETS.forEach(p => addOrbit(p.orbit));

    // build planets
    const loader = new THREE.TextureLoader();
    PLANETS.forEach((cfg, i) => {
      const mat = makePlanetMaterial(cfg.tex, cfg.color);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 64, 64), mat);
      mesh.userData = {
        name: cfg.name, url: cfg.url, label: cfg.label,
        orbit: cfg.orbit, speed: cfg.speed,
        angle: i * 0.85 + 0.3, baseRot: 0.004 + Math.random() * 0.01
      };
      mesh.position.set(Math.cos(mesh.userData.angle) * cfg.orbit, 0, Math.sin(mesh.userData.angle) * cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 220);
      sprite.scale.set(18, 9, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 7, 0));
      scene.add(sprite);
      labels.push(sprite);

      if (cfg.name === "Saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size * 1.2, cfg.size * 2.2, 96),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, color: 0xffffff })
        );
        loader.load(`${TEX}/saturnringcolor.jpg`, (t) => { ring.material.map = t; ring.material.needsUpdate = true; });
        loader.load(`${TEX}/saturnringpattern.gif`, (t) => { ring.material.alphaMap = t; ring.material.needsUpdate = true; });
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(mesh.position);
        scene.add(ring);
        rings.push(ring);
        mesh.userData.ring = ring;
      }
    });

    // ---------- interactions ----------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hovered = null;

    function setLabelVisible(sprite, visible) {
      const target = visible ? 1 : 0;
      if (sprite.material.opacity === target) return;
      gsap.to(sprite.material, { opacity: target, duration: 0.25, ease: "power2.out" });
      if (visible) {
        gsap.fromTo(sprite.scale,
          { x: sprite.scale.x * 0.92, y: sprite.scale.y * 0.92, z: 1 },
          { x: sprite.scale.x,        y: sprite.scale.y,        z: 1, duration: 0.25, ease: "power2.out" }
        );
      }
    }

    function onPointerMove(e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planets, false);

      if (hits.length) {
        const obj = hits[0].object;
        if (hovered !== obj) {
          if (hovered) {
            setLabelVisible(labels[planets.indexOf(hovered)], false);
            gsap.to(hovered.scale, { x: 1, y: 1, z: 1, duration: 0.15 });
          }
          hovered = obj;
          setLabelVisible(labels[planets.indexOf(obj)], true);
          gsap.to(obj.scale, { x: 1.06, y: 1.06, z: 1.06, duration: 0.15 });
          document.body.style.cursor = "pointer";
        }
      } else {
        if (hovered) {
          setLabelVisible(labels[planets.indexOf(hovered)], false);
          gsap.to(hovered.scale, { x: 1, y: 1, z: 1, duration: 0.15 });
        }
        hovered = null;
        document.body.style.cursor = "default";
      }
    }
    window.addEventListener("pointermove", onPointerMove);

    window.addEventListener("click", () => {
      if (!hovered) return;
      const url = hovered.userData.url;
      if (url) window.location.href = url;
    });

    // ---------- LOCKED SCROLL TOUR (UFO → Neptune) ----------
    const focusTargets = [ufo, ...planets];
    let focusIndex = 0;
    let focusOffset = new THREE.Vector3(0, 10, 60); // gets resized per target
    const lookAtTarget = new THREE.Vector3(0, 0, 0);
    let lastWheel = 0;

    function labelFor(obj) {
      return obj.name || (obj.userData && obj.userData.name) || (obj === ufo ? "UFO" : "");
    }

    function focusOn(index, immediate = false) {
      focusIndex = THREE.MathUtils.clamp(index, 0, focusTargets.length - 1);
      const obj = focusTargets[focusIndex];

      // distance/height based on object radius
      const radius = obj.geometry?.parameters?.radius || (obj === ufo ? 4.5 : 6);
      const dist   = radius * 6.5;
      const height = radius * 2.2;
      focusOffset.set(0, height, dist);

      hud.textContent = `Focus: ${labelFor(obj)}`;
      gsap.to(hud, { opacity: 1, duration: 0.25 });

      // immediate snap (for first load), otherwise smooth lerp in tick
      if (immediate) {
        const p = obj.position.clone().add(focusOffset);
        camera.position.copy(p);
        lookAtTarget.copy(obj.position);
      }
    }

    function onWheel(e) {
      const now = performance.now();
      if (now - lastWheel < 450) return; // debounce so it feels snappy & intentional
      lastWheel = now;
      e.preventDefault();
      focusOn(focusIndex + (e.deltaY > 0 ? 1 : -1));
    }
    window.addEventListener("wheel", onWheel, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") focusOn(focusIndex + 1);
      if (e.key === "ArrowLeft")  focusOn(focusIndex - 1);
    });

    // start on the UFO
    focusOn(0, true);

    // resize
    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    // animate (camera stays locked to the current focus target)
    (function animate() {
      requestAnimationFrame(animate);

      // ufo idle motion
      ufo.rotation.y += 0.004;
      ufo.position.y = Math.sin(performance.now() * 0.0012) * 0.35;

      planets.forEach((p, i) => {
        p.userData.angle += p.userData.speed;
        const r = p.userData.orbit;
        p.position.set(Math.cos(p.userData.angle) * r, 0, Math.sin(p.userData.angle) * r);
        p.rotation.y += p.userData.baseRot;

        if (p.userData.ring) p.userData.ring.position.copy(p.position);

        const label = labels[i];
        if (label) {
          label.position.set(p.position.x, p.position.y + (p.geometry.parameters.radius || 1) + 7, p.position.z);
          label.lookAt(camera.position);
        }
      });

      // keep camera locked on the focused target as it moves
      const obj = focusTargets[focusIndex];
      const targetPos = obj.position.clone();
      const desired = targetPos.clone().add(focusOffset);
      camera.position.lerp(desired, 0.08);
      lookAtTarget.lerp(targetPos, 0.12);
      camera.lookAt(lookAtTarget);

      renderer.render(scene, camera);
    })();
  };
})();
