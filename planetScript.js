/*
 * planetScript.js — Textured planets + curved labels + click-through
 * Exposes window.initSolarSystem(). Requires Three.js + GSAP.
 */

(function () {
  const TEX = "https://threejs.org/examples/textures/planets";

  // ----- curved-label sprite -----
  function makeCurvedLabel(text, diameterPx = 180) {
    const pad = 24;
    const size = diameterPx + pad * 2;
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
    sprite.userData.opacityTarget = 0;
    return sprite;
  }

  // ----- stars -----
  function makeStars(count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(120, 520);
      const theta = Math.random() * Math.PI * 2;
      const y = THREE.MathUtils.randFloatSpread(220);
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.8, sizeAttenuation: true, color: 0xffffff, transparent: true, opacity: 0.9
    });
    return new THREE.Points(geo, mat);
  }

  // ===== main =====
  window.initSolarSystem = function initSolarSystem() {
    const canvas = document.getElementById("solar-scene");
    if (!canvas) { console.warn("No #solar-scene"); return; }

    // renderer / camera / scene
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070a14, 0.012);
    scene.add(makeStars(2500));

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 80, 320);

    // lights + sun
    const ambient = new THREE.AmbientLight(0xffffff, 0.28);
    const sunLight = new THREE.PointLight(0xffffff, 1.2, 0, 2);
    sunLight.position.set(0, 0, 0);
    scene.add(ambient, sunLight);

    const loader = new THREE.TextureLoader();

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(14, 64, 64),
      new THREE.MeshBasicMaterial({ map: loader.load(`${TEX}/sun.jpg`) })
    );
    sun.name = "Sun";
    scene.add(sun);

    // planets config — map URLs to your sections
    const PLANETS = [
      { name: "Mercury", tex: `${TEX}/mercury.jpg`, size: 2.2, orbit: 26,  speed: 0.020, url: "about.html",        label: "About"     },
      { name: "Venus",   tex: `${TEX}/venus.jpg`,   size: 3.5, orbit: 36,  speed: 0.016, url: "writing.html",      label: "Writing"   },
      { name: "Earth",   tex: `${TEX}/earth_atmos_2048.jpg`, size: 3.7, orbit: 48,  speed: 0.014, url: "projects.html",     label: "Projects"  },
      { name: "Mars",    tex: `${TEX}/mars_1k_color.jpg`,    size: 3.0, orbit: 60,  speed: 0.012, url: "photography.html",  label: "Photos"    },
      { name: "Jupiter", tex: `${TEX}/jupiter2_1024.jpg`,    size: 8.5, orbit: 84,  speed: 0.009, url: "resume.html",       label: "Resume"    },
      { name: "Saturn",  tex: `${TEX}/saturn.jpg`,           size: 7.5, orbit: 106, speed: 0.008, url: "contact.html",      label: "Contact"   },
      { name: "Uranus",  tex: `${TEX}/uranus.jpg`,           size: 6.0, orbit: 126, speed: 0.007, url: "links.html",        label: "Links"     },
      { name: "Neptune", tex: `${TEX}/neptune.jpg`,          size: 5.8, orbit: 144, speed: 0.006, url: "blog.html",         label: "Blog"      },
    ];

    // build planets
    const planets = [];
    const labels  = [];
    PLANETS.forEach((cfg, i) => {
      const mat = new THREE.MeshStandardMaterial({
        map: loader.load(cfg.tex), roughness: 1, metalness: 0
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 64, 64), mat);
      mesh.userData = {
        name: cfg.name, url: cfg.url, label: cfg.label,
        orbit: cfg.orbit, speed: cfg.speed, angle: i * 0.8 + 0.3,
        baseRot: 0.003 + Math.random() * 0.01
      };
      mesh.position.set(Math.cos(mesh.userData.angle) * cfg.orbit, 0, Math.sin(mesh.userData.angle) * cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      // Curved label
      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 200);
      sprite.scale.set(18, 9, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 6, 0));
      scene.add(sprite);
      labels.push(sprite);

      // Saturn rings
      if (cfg.name === "Saturn") {
        const ringTex = loader.load(`${TEX}/saturnringcolor.jpg`);
        const ringAlpha = loader.load(`${TEX}/saturnringpattern.gif`);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size * 1.2, cfg.size * 2.2, 96),
          new THREE.MeshBasicMaterial({ map: ringTex, alphaMap: ringAlpha, side: THREE.DoubleSide, transparent: true })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(mesh.position);
        scene.add(ring);
        mesh.userData.ring = ring;
      }
    });

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
    function onResize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    // intro camera glide
    gsap.fromTo(camera.position, { z: 460, y: 30 }, { z: 320, y: 80, duration: 1.8, ease: "power2.out" });

    // animate
    function animate() {
      requestAnimationFrame(animate);

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

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    animate();
  };
})();
