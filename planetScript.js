/*
 * planetScript.js — stable & bright edition
 * Textured planets + curved labels + click-through.
 * Requires Three.js + GSAP. Exposes window.initSolarSystem().
 */

(function () {
  const TEX = "https://threejs.org/examples/textures/planets";

  // Find or create a canvas so we always render somewhere
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

  // ---- curved label (canvas → sprite) ----
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
    const sprite = new THREE.Sprite(mat);
    return sprite;
  }

  // ---- stars ----
  function makeStars(count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(140, 520);
      const theta = Math.random() * Math.PI * 2;
      const y = THREE.MathUtils.randFloatSpread(220);
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ size: 0.8, sizeAttenuation: true, color: 0xffffff, opacity: 0.95, transparent: true });
    return new THREE.Points(geo, mat);
  }

  // ---- safe material loader with color fallback ----
  function makePlanetMaterial(url, fallbackColor = 0x888888) {
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 1, metalness: 0 });
    loader.load(
      url,
      (tx) => { mat.map = tx; mat.needsUpdate = true; },
      undefined,
      () => { /* texture failed; keep color fallback */ }
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
    scene.background = new THREE.Color(0x000000);     // solid black
    // scene.fog = new THREE.FogExp2(0x070a14, 0.010); // <- disabled to avoid hiding far planets
    scene.add(makeStars(2600));

    // camera (closer + friendly)
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 70, 260);

    // lights (brighter so textures pop even if point light misses)
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(ambient, sunLight);

    // SUN
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(14, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xffcc55 }) // also add a texture if you want
    );
    scene.add(sun);

    // planets config — edit URLs/labels to your pages
    const PLANETS = [
      { name: "Mercury", tex: `${TEX}/mercury.jpg`,              color: 0x9c9c9c, size: 2.2, orbit: 26,  speed: 0.020, url: "about.html",        label: "About" },
      { name: "Venus",   tex: `${TEX}/venus.jpg`,                color: 0xd8b57a, size: 3.5, orbit: 36,  speed: 0.016, url: "writing.html",      label: "Writing" },
      { name: "Earth",   tex: `${TEX}/earth_atmos_2048.jpg`,     color: 0x5aa0ff, size: 3.7, orbit: 48,  speed: 0.014, url: "projects.html",     label: "Projects" },
      { name: "Mars",    tex: `${TEX}/mars_1k_color.jpg`,        color: 0xb55a3c, size: 3.0, orbit: 60,  speed: 0.012, url: "photography.html",  label: "Photos" },
      { name: "Jupiter", tex: `${TEX}/jupiter2_1024.jpg`,        color: 0xe0c7a2, size: 8.5, orbit: 84,  speed: 0.009, url: "resume.html",       label: "Resume" },
      { name: "Saturn",  tex: `${TEX}/saturn.jpg`,               color: 0xdcc7a0, size: 7.5, orbit: 106, speed: 0.008, url: "contact.html",      label: "Contact" },
      { name: "Uranus",  tex: `${TEX}/uranus.jpg`,               color: 0x88e0e8, size: 6.0, orbit: 126, speed: 0.007, url: "links.html",        label: "Links" },
      { name: "Neptune", tex: `${TEX}/neptune.jpg`,              color: 0x4a6eff, size: 5.8, orbit: 144, speed: 0.006, url: "blog.html",         label: "Blog" },
    ];

    const planets = [];
    const labels  = [];

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

      // curved label
      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 200);
      sprite.scale.set(18, 9, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 6, 0));
      scene.add(sprite);
      labels.push(sprite);

      // saturn ring
      if (cfg.name === "Saturn") {
        const loader = new THREE.TextureLoader();
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size * 1.2, cfg.size * 2.2, 96),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, color: 0xffffff })
        );
        // try to apply textures but don't fail if blocked
        loader.load(`${TEX}/saturnringcolor.jpg`, (t) => { ring.material.map = t; ring.material.needsUpdate = true; });
        loader.load(`${TEX}/saturnringpattern.gif`, (t) => { ring.material.alphaMap = t; ring.material.needsUpdate = true; });
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(mesh.position);
        scene.add(ring);
        mesh.userData.ring = ring;
      }
    });

    console.log(`Built planets: ${planets.length}`);

    // interactions
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

    function onClick() {
      if (!hovered) return;
      const url = hovered.userData.url;
      if (url) window.location.href = url;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("click", onClick);

    // resize
    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    // intro glide + slow auto-orbit so you see everything
    gsap.fromTo(camera.position, { z: 360, y: 50 }, { z: 260, y: 70, duration: 1.4, ease: "power2.out" });

    let autoAngle = 0;
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

      // very slow auto camera orbit (helps discoverability)
      autoAngle += 0.0008;
      camera.position.x = Math.cos(autoAngle) * 260;
      camera.position.z = Math.sin(autoAngle) * 260;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    })();
  };
})();
