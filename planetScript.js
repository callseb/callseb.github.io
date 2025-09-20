/*
 * planetScript.js — Detailed Sun + slowed orbits + zoomed-out start
 * Requires Three.js + GSAP. Exposes window.initSolarSystem().
 */

(function () {
  const TEX = "https://threejs.org/examples/textures/planets";
  const STAR_SPRITE = "https://threejs.org/examples/textures/sprites/disc.png";

  // ---------- DOM ----------
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
      color: "#ffeeb0",
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

  // ---------- Curved label ----------
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
    ctx.fillStyle = "#ffeeb0";
    ctx.shadowColor = "rgba(255,200,80,.35)";
    ctx.shadowBlur = 12;
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

  // ---------- Stars ----------
  function makeStars({ count = 4000, rMin = 1200, rMax = 2000 } = {}) {
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
      map: tex, size: 1.5, sizeAttenuation: true,
      color: 0xffffff, transparent: true, alphaTest: 0.4, depthWrite: false, opacity: 0.9
    });
    return new THREE.Points(geo, mat);
  }

  // ---------- Materials ----------
  function makePlanetMaterial(url, fallbackColor = 0x888888) {
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 1, metalness: 0 });
    loader.load(url, (tx) => { mat.map = tx; mat.needsUpdate = true; });
    return mat;
  }

  // ---------- Detailed Sun ----------
  function buildSun() {
    const g = new THREE.Group();
    const loader = new THREE.TextureLoader();

    const sunMat = new THREE.MeshBasicMaterial({
      map: loader.load(`${TEX}/sun.jpg`),
      emissive: 0xffaa33,
      emissiveIntensity: 0.6
    });

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(18, 64, 64), sunMat);
    g.add(sphere);

    // glow
    const glowCvs = document.createElement("canvas");
    glowCvs.width = glowCvs.height = 256;
    const ctx = glowCvs.getContext("2d");
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,200,80,0.45)");
    grad.addColorStop(1, "rgba(255,200,80,0.0)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCvs), transparent: true, depthWrite: false }));
    glow.scale.set(80, 80, 1);
    g.add(glow);

    g.name = "Sun";
    return g;
  }

  window.initSolarSystem = function initSolarSystem() {
    const canvas = getOrCreateCanvas();
    const hud = makeHUD();

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.add(makeStars());

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000);
    camera.position.set(0, 150, 500); // pulled back further

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const sunLight = new THREE.PointLight(0xffffff, 2.4, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(ambient, sunLight);

    const sun = buildSun();
    scene.add(sun);

    // planets config — slowed orbits (speed halved vs before)
    const PLANETS = [
      { name: "Mercury", tex: `${TEX}/mercury.jpg`,              color: 0x9c9c9c, size: 2.2, orbit: 46,  speed: 0.010, url: "about.html",        label: "About" },
      { name: "Venus",   tex: `${TEX}/venus.jpg`,                color: 0xd8b57a, size: 3.5, orbit: 66,  speed: 0.008, url: "writing.html",      label: "Writing" },
      { name: "Earth",   tex: `${TEX}/earth_atmos_2048.jpg`,     color: 0x5aa0ff, size: 3.7, orbit: 86,  speed: 0.007, url: "projects.html",     label: "Projects" },
      { name: "Mars",    tex: `${TEX}/mars_1k_color.jpg`,        color: 0xb55a3c, size: 3.0, orbit: 110, speed: 0.006, url: "photography.html",  label: "Photos" },
      { name: "Jupiter", tex: `${TEX}/jupiter2_1024.jpg`,        color: 0xe0c7a2, size: 8.5, orbit: 150, speed: 0.004, url: "resume.html",       label: "Resume" },
      { name: "Saturn",  tex: `${TEX}/saturn.jpg`,               color: 0xdcc7a0, size: 7.5, orbit: 200, speed: 0.004, url: "contact.html",      label: "Contact" },
      { name: "Uranus",  tex: `${TEX}/uranus.jpg`,               color: 0x88e0e8, size: 6.0, orbit: 250, speed: 0.003, url: "links.html",        label: "Links" },
      { name: "Neptune", tex: `${TEX}/neptune.jpg`,              color: 0x4a6eff, size: 5.8, orbit: 290, speed: 0.003, url: "blog.html",         label: "Blog" },
    ];

    const planets = [];
    const labels  = [];

    PLANETS.forEach((cfg, i) => {
      const mat = makePlanetMaterial(cfg.tex, cfg.color);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 64, 64), mat);
      mesh.userData = {
        name: cfg.name, url: cfg.url, label: cfg.label,
        orbit: cfg.orbit, speed: cfg.speed,
        angle: i * 0.85 + 0.3, baseRot: 0.002 + Math.random() * 0.004
      };
      mesh.position.set(Math.cos(mesh.userData.angle) * cfg.orbit, 0, Math.sin(mesh.userData.angle) * cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 220);
      sprite.scale.set(18, 9, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 7, 0));
      scene.add(sprite);
      labels.push(sprite);
    });

    // ---------- Interactions ----------
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hovered = null;

    function setLabelVisible(sprite, visible) {
      const target = visible ? 1 : 0;
      if (sprite.material.opacity === target) return;
      gsap.to(sprite.material, { opacity: target, duration: 0.25, ease: "power2.out" });
    }

    function onPointerMove(e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(planets, false);

      if (hits.length) {
        const obj = hits[0].object;
        if (hovered !== obj) {
          if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
          hovered = obj;
          setLabelVisible(labels[planets.indexOf(obj)], true);
          document.body.style.cursor = "pointer";
        }
      } else {
        if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
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

    // ---------- Animate ----------
    (function animate() {
      requestAnimationFrame(animate);

      planets.forEach((p, i) => {
        p.userData.angle += p.userData.speed;
        const r = p.userData.orbit;
        p.position.set(Math.cos(p.userData.angle) * r, 0, Math.sin(p.userData.angle) * r);
        p.rotation.y += p.userData.baseRot;

        const label = labels[i];
        if (label) {
          label.position.set(p.position.x, p.position.y + (p.geometry.parameters.radius || 1) + 7, p.position.z);
          label.lookAt(camera.position);
        }
      });

      renderer.render(scene, camera);
    })();
  };
})();
