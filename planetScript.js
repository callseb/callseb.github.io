/*
 * planetScript.js — Far-star field + scroll-to-zoom tour + textured planets
 * Requires Three.js + GSAP. Exposes window.initSolarSystem().
 */

(function () {
  const TEX = "https://threejs.org/examples/textures/planets";
  const STAR_SPRITE = "https://threejs.org/examples/textures/sprites/disc.png";

  // ---------- utilities ----------
  function getOrCreateCanvas() {
    let canvas =
      document.getElementById("solar-scene") ||
      document.getElementById("scene");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "solar-scene";
      Object.assign(canvas.style, {
        position: "fixed",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "block",
      });
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  // Curved label
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
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0
    });
    return new THREE.Sprite(mat);
  }

  // Far-away star shell (no close stars)
  function makeStars({ count = 3000, rMin = 800, rMax = 1600 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    // distribute on a thick spherical shell far from origin
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(rMin, rMax);
      const theta = Math.acos(THREE.MathUtils.randFloatSpread(2)); // [0,pi]
      const phi = Math.random() * Math.PI * 2;                      // [0,2pi]
      positions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // round sprite so stars are not squares
    const tex = new THREE.TextureLoader().load(STAR_SPRITE);
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: 2.0,
      sizeAttenuation: true,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.5,
      opacity: 0.9,
      depthWrite: false,
    });

    return new THREE.Points(geo, mat);
  }

  // safer planet material (falls back to color if texture fails)
  function makePlanetMaterial(url, fallbackColor = 0x888888) {
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 1, metalness: 0 });
    loader.load(
      url,
      (tx) => { mat.map = tx; mat.needsUpdate = true; },
      undefined,
      () => { /* keep color */ }
    );
    return mat;
  }

  window.initSolarSystem = function initSolarSystem() {
    const canvas = getOrCreateCanvas();

    // renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.add(makeStars()); // far shell

    // camera
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
    camera.position.set(0, 75, 280);

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(ambient, sunLight);

    // SUN (basic)
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(14, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xffcc55 })
    );
    sun.name = "Sun";
    scene.add(sun);

    // planets config — map URLs to your pages
    const PLANETS = [
      { name: "Mercury", tex: `${TEX}/mercury.jpg`,              color: 0x9c9c9c, size: 2.2, orbit: 28,  speed: 0.020, url: "about.html",        label: "About" },
      { name: "Venus",   tex: `${TEX}/venus.jpg`,                color: 0xd8b57a, size: 3.5, orbit: 38,  speed: 0.016, url: "writing.html",      label: "Writing" },
      { name: "Earth",   tex: `${TEX}/earth_atmos_2048.jpg`,     color: 0x5aa0ff, size: 3.7, orbit: 50,  speed: 0.014, url: "projects.html",     label: "Projects" },
      { name: "Mars",    tex: `${TEX}/mars_1k_color.jpg`,        color: 0xb55a3c, size: 3.0, orbit: 62,  speed: 0.012, url: "photography.html",  label: "Photos" },
      { name: "Jupiter", tex: `${TEX}/jupiter2_1024.jpg`,        color: 0xe0c7a2, size: 8.5, orbit: 88,  speed: 0.009, url: "resume.html",       label: "Resume" },
      { name: "Saturn",  tex: `${TEX}/saturn.jpg`,               color: 0xdcc7a0, size: 7.5, orbit: 112, speed: 0.008, url: "contact.html",      label: "Contact" },
      { name: "Uranus",  tex: `${TEX}/uranus.jpg`,               color: 0x88e0e8, size: 6.0, orbit: 132, speed: 0.007, url: "links.html",        label: "Links" },
      { name: "Neptune", tex: `${TEX}/neptune.jpg`,              color: 0x4a6eff, size: 5.8, orbit: 150, speed: 0.006, url: "blog.html",         label: "Blog" },
    ];

    const loader = new THREE.TextureLoader();
    const planets = [];
    const labels  = [];

    // build planets
    PLANETS.forEach((cfg, i) => {
      const mat = makePlanetMaterial(cfg.tex, cfg.color);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 64, 64), mat);
      mesh.userData = {
        name: cfg.name, url: cfg.url, label: cfg.label,
        orbit: cfg.orbit, speed: cfg.speed,
        angle: i * 0.8 + 0.3, baseRot: 0.004 + Math.random() * 0.01
      };
      mesh.position.set(Math.cos(mesh.userData.angle) * cfg.orbit, 0, Math.sin(mesh.userData.angle) * cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      // label
      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 200);
      sprite.scale.set(18, 9, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 6, 0));
      scene.add(sprite);
      labels.push(sprite);

      // saturn ring
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

    // click-through
    function onClick() {
      if (!hovered) return;
      const url = hovered.userData.url;
      if (url) window.location.href = url;
    }
    window.addEventListener("click", onClick);

    // ---------- SCROLL-TO-ZOOM TOUR ----------
    // Targets: Sun + planets
    const focusTargets = [sun, ...planets];
    let focusIndex = 0;
    const lookAtTarget = new THREE.Vector3(0, 0, 0);

    function focusOn(index) {
      focusIndex = THREE.MathUtils.clamp(index, 0, focusTargets.length - 1);
      const obj = focusTargets[focusIndex];

      // distance from target based on object size
      const radius = obj.geometry && obj.geometry.parameters && obj.geometry.parameters.radius
        ? obj.geometry.parameters.radius
        : 10;

      // camera offset relative to target (slightly above + back)
      const targetPos = obj.position.clone();
      const offset = new THREE.Vector3(0, radius * 2.2, radius * 6.0);
      const dest = targetPos.clone().add(offset);

      gsap.to(camera.position, {
        x: dest.x, y: dest.y, z: dest.z,
        duration: 0.9, ease: "power2.out"
      });
      gsap.to(lookAtTarget, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z,
        duration: 0.9, ease: "power2.out"
      });
    }

    // wheel advances / reverses focus: Sun → Mercury → … → Neptune
    function onWheel(e) {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      focusOn(focusIndex + dir);
    }
    window.addEventListener("wheel", onWheel, { passive: false });

    // also allow left/right arrow keys
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") focusOn(focusIndex + 1);
      if (e.key === "ArrowLeft")  focusOn(focusIndex - 1);
    });

    // start focused on the Sun
    focusOn(0);

    // resize
    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    // animate
    (function animate() {
      requestAnimationFrame(animate);

      // move planets
      planets.forEach((p, i) => {
        p.userData.angle += p.userData.speed;
        const r = p.userData.orbit;
        p.position.set(Math.cos(p.userData.angle) * r, 0, Math.sin(p.userData.angle) * r);
        p.rotation.y += p.userData.baseRot;

        if (p.userData.ring) p.userData.ring.position.copy(p.position);

        const label = labels[i];
        if (label) {
          label.position.set(p.position.x, p.position.y + (p.geometry.parameters.radius || 1) + 6, p.position.z);
          label.lookAt(camera.position);
        }
      });

      camera.lookAt(lookAtTarget);
      renderer.render(scene, camera);
    })();
  };
})();
