/* SOLAR — parallax starfield + scroll-to-lock + pinned card */
(() => {
  // ====== DOM refs ======
  const canvas = document.getElementById('solar-scene');
  const hint   = document.getElementById('hint');
  const skip   = document.getElementById('tour-skip');
  const lockCard = document.getElementById('lock-card');
  const lockTitle = document.getElementById('lock-title');
  const lockSub   = document.getElementById('lock-sub');

  // ====== Three singletons ======
  let renderer, scene, camera, raycaster, mouse;
  let sun, planets=[], labels=[];
  let starsNear, starsMid, starsFar;
  let hovered = null;
  let focusTargets = [], focusIndex = 0;
  const lookAtTarget = new THREE.Vector3(0,0,0);
  const worldToScreen = new THREE.Vector3();

  // ====== API ======
  window.initSolarSystem = function initSolarSystem(){
    // renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // camera (closer, cinematic)
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000);
    camera.position.set(0, 120, 420);

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 2);
    sunLight.position.set(0,0,0);
    scene.add(ambient, sunLight);

    // starfield (3 shells with parallax)
    [starsNear, starsMid, starsFar] = [
      makeStars({ count: 2000, rMin: 600,  rMax: 1000, size: 1.9 }),
      makeStars({ count: 2600, rMin: 1200, rMax: 1800, size: 1.6 }),
      makeStars({ count: 3200, rMin: 2200, rMax: 3200, size: 1.3 })
    ];
    scene.add(starsFar, starsMid, starsNear);

    // Sun (detailed + glow)
    sun = buildSun();
    scene.add(sun);

    // planets (spaced + slower)
    const TEX = "https://threejs.org/examples/textures/planets";
    const PLANETS = [
      { name:"Mercury", tex:`${TEX}/mercury.jpg`,              color:0x9c9c9c, size:2.2, orbit: 46,  speed:0.010, url:"about.html",       label:"About"   },
      { name:"Venus",   tex:`${TEX}/venus.jpg`,                color:0xd8b57a, size:3.5, orbit: 66,  speed:0.008, url:"writing.html",     label:"Writing" },
      { name:"Earth",   tex:`${TEX}/earth_atmos_2048.jpg`,     color:0x5aa0ff, size:3.7, orbit: 86,  speed:0.007, url:"projects.html",    label:"Projects"},
      { name:"Mars",    tex:`${TEX}/mars_1k_color.jpg`,        color:0xb55a3c, size:3.0, orbit:110,  speed:0.006, url:"photography.html", label:"Photos"  },
      { name:"Jupiter", tex:`${TEX}/jupiter2_1024.jpg`,        color:0xe0c7a2, size:8.5, orbit:150,  speed:0.004, url:"resume.html",      label:"Resume"  },
      { name:"Saturn",  tex:`${TEX}/saturn.jpg`,               color:0xdcc7a0, size:7.5, orbit:200,  speed:0.004, url:"contact.html",     label:"Contact" },
      { name:"Uranus",  tex:`${TEX}/uranus.jpg`,               color:0x88e0e8, size:6.0, orbit:250,  speed:0.003, url:"links.html",       label:"Links"   },
      { name:"Neptune", tex:`${TEX}/neptune.jpg`,              color:0x4a6eff, size:5.8, orbit:290,  speed:0.003, url:"blog.html",        label:"Blog"    },
    ];

    // orbit rings (subtle)
    PLANETS.forEach(p => addOrbitRing(p.orbit));

    // build planets
    planets.length = 0; labels.length = 0;
    const loader = new THREE.TextureLoader();
    PLANETS.forEach((cfg,i)=>{
      const mat = makePlanetMaterial(cfg.tex, cfg.color);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 64, 64), mat);
      mesh.userData = {
        name: cfg.name, url: cfg.url, label: cfg.label,
        orbit: cfg.orbit, speed: cfg.speed,
        angle: i*0.85+0.3, baseRot: 0.002 + Math.random()*0.004
      };
      mesh.position.set(Math.cos(mesh.userData.angle)*cfg.orbit, 0, Math.sin(mesh.userData.angle)*cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      const lab = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 220);
      lab.scale.set(18,9,1);
      lab.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size + 7, 0));
      scene.add(lab);
      labels.push(lab);

      if (cfg.name === "Saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size*1.2, cfg.size*2.2, 96),
          new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, color: 0xffffff })
        );
        loader.load(`${TEX}/saturnringcolor.jpg`, t => { ring.material.map=t; ring.material.needsUpdate=true; });
        loader.load(`${TEX}/saturnringpattern.gif`, t => { ring.material.alphaMap=t; ring.material.needsUpdate=true; });
        ring.rotation.x = -Math.PI/2;
        ring.position.copy(mesh.position);
        scene.add(ring);
        mesh.userData.ring = ring;
      }
    });

    // interactions
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('click', onClick);
    window.addEventListener('wheel', onWheel, { passive:false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);

    // focus targets
    focusTargets = [sun, ...planets];

    // gentle UI hint
    gsap.to(hint, { opacity:1, delay:1.0, duration:.6 });

    animate();
  };

  // Public sequence: overview → focus first planet
  window.startWelcomeSequence = function startWelcomeSequence(){
    // zoomed-out overview
    camera.position.set(0, 140, 520);
    camera.lookAt(0,0,0);
    if (skip) skip.hidden = false;

    // short dolly + then Mercury
    const go = () => {
      focusOn(1); // Mercury
      if (skip) { skip.hidden = true; skip.onclick = null; }
    };
    if (skip) skip.onclick = go;
    gsap.to(camera.position, { z: 420, duration: 1.4, ease: "power1.out", onComplete: go });
  };

  // ===== Helpers =====
  function makeStars({ count=3000, rMin=1200, rMax=2000, size=1.6 }={}){
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count*3);
    for (let i=0;i<count;i++){
      const r = THREE.MathUtils.randFloat(rMin, rMax);
      const t = Math.acos(THREE.MathUtils.randFloatSpread(2));
      const p = Math.random()*Math.PI*2;
      positions[i*3+0] = r * Math.sin(t) * Math.cos(p);
      positions[i*3+1] = r * Math.cos(t);
      positions[i*3+2] = r * Math.sin(t) * Math.sin(p);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    const tex = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png'); // round sprite
    const mat = new THREE.PointsMaterial({ map: tex, size, sizeAttenuation:true, color:0xffffff, alphaTest:0.45, transparent:true, opacity:0.95, depthWrite:false });
    return new THREE.Points(geo, mat);
  }

  function makePlanetMaterial(url, fallback=0x888888){
    const loader = new THREE.TextureLoader();
    const m = new THREE.MeshStandardMaterial({ color: fallback, roughness:1, metalness:0 });
    loader.load(url, tx => { m.map = tx; m.needsUpdate = true; });
    return m;
  }

  function buildSun(){
    const TEX = "https://threejs.org/examples/textures/planets";
    const g = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const sunMat = new THREE.MeshBasicMaterial({ map: loader.load(`${TEX}/sun.jpg`) });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(18, 64,64), sunMat);
    g.add(sphere);
    // halo
    const cvs = document.createElement('canvas'); cvs.width=cvs.height=256;
    const ctx = cvs.getContext('2d'); const grd = ctx.createRadialGradient(128,128,0,128,128,128);
    grd.addColorStop(0,"rgba(255,200,80,0.45)"); grd.addColorStop(1,"rgba(255,200,80,0.0)");
    ctx.fillStyle=grd; ctx.fillRect(0,0,256,256);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cvs), transparent:true, depthWrite:false }));
    glow.scale.set(80,80,1);
    g.add(glow);
    g.name = "Sun";
    return g;
  }

  function makeCurvedLabel(text, diameterPx=200){
    const pad=24, size=diameterPx+pad*2;
    const cvs=document.createElement('canvas'); cvs.width=cvs.height=size;
    const ctx=cvs.getContext('2d');
    ctx.translate(size/2,size/2);
    const radius=diameterPx/2; const chars=[...text];
    ctx.font = `800 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#ffeeb0";
    ctx.shadowColor="rgba(255,200,80,.35)";
    ctx.shadowBlur=12; ctx.textBaseline="middle"; ctx.textAlign="center";
    const arc=Math.PI*0.9, step=arc/Math.max(chars.length,1); let ang=-arc/2;
    for(const ch of chars){ ctx.save(); ctx.rotate(ang); ctx.translate(0,-radius); ctx.rotate(-Math.PI/2); ctx.fillText(ch,0,0); ctx.restore(); ang+=step; }
    const tex = new THREE.CanvasTexture(cvs);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, opacity:0 }));
  }

  function addOrbitRing(radius){
    const segs=256, pts=[];
    for(let i=0;i<=segs;i++){ const a=(i/segs)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*radius,0,Math.sin(a)*radius)); }
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const mat=new THREE.LineBasicMaterial({ color:0x223344, transparent:true, opacity:0.35 });
    scene.add(new THREE.LineLoop(geo,mat));
  }

  // ===== Focus logic =====
  function focusOn(index){
    focusIndex = THREE.MathUtils.clamp(index, 0, focusTargets.length-1);
    const obj = focusTargets[focusIndex];
    const r = obj.geometry?.parameters?.radius || 6;
    const dist = r*5.5;
    const height = r*2.2;
    const targetPos = obj.position.clone();
    const dest = targetPos.clone().add(new THREE.Vector3(0,height,dist));

    // update lock card contents
    const name = obj.name || obj.userData?.name || (focusIndex===0?'Sun':'');
    const label = obj.userData?.label || (focusIndex===0?'Home':'');
    lockTitle.textContent = name;
    lockSub.textContent = label;
    lockCard.hidden = false;

    gsap.to(camera.position, { x:dest.x, y:dest.y, z:dest.z, duration:0.85, ease:"power2.out" });
    gsap.to(lookAtTarget,   { x:targetPos.x, y:targetPos.y, z:targetPos.z, duration:0.85, ease:"power2.out" });
  }

  // ===== Interactions =====
  function setLabelVisible(sprite, visible){
    const target = visible ? 1 : 0;
    if (!sprite || sprite.material.opacity === target) return;
    gsap.to(sprite.material, { opacity: target, duration:0.25, ease:"power2.out" });
  }

  function onPointerMove(e){
    mouse.x = (e.clientX / window.innerWidth)*2 - 1;
    mouse.y =-(e.clientY / window.innerHeight)*2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets,false);

    if (hits.length){
      const obj = hits[0].object;
      if (hovered !== obj){
        if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
        hovered = obj;
        setLabelVisible(labels[planets.indexOf(obj)], true);
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
      hovered = null;
      document.body.style.cursor = 'default';
    }
  }

  function onClick(){
    if (!hovered) return;
    const url = hovered.userData.url;
    if (url) window.location.href = url;
  }

  // scroll to lock next/prev
  let lastWheel = 0;
  function onWheel(e){
    const now = performance.now();
    if (now - lastWheel < 420) return; // debounce so it locks one-by-one
    lastWheel = now;
    e.preventDefault();
    focusOn(focusIndex + (e.deltaY > 0 ? 1 : -1));
  }
  function onKey(e){
    if (e.key === 'ArrowRight') focusOn(focusIndex+1);
    if (e.key === 'ArrowLeft')  focusOn(focusIndex-1);
  }

  function onResize(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ===== Animate =====
  function animate(){
    requestAnimationFrame(animate);

    // star parallax — move shells slightly opposite camera direction
    const cam = camera.position;
    starsNear.position.set(cam.x*-0.015, cam.y*-0.008, cam.z*-0.015);
    starsMid .position.set(cam.x*-0.010, cam.y*-0.005, cam.z*-0.010);
    starsFar .position.set(cam.x*-0.006,  cam.y*-0.003, cam.z*-0.006);

    // Sun idle
    if (sun) sun.rotation.y += 0.002;

    // orbits + labels
    planets.forEach((p,i)=>{
      p.userData.angle += p.userData.speed;
      const r = p.userData.orbit;
      p.position.set(Math.cos(p.userData.angle)*r, 0, Math.sin(p.userData.angle)*r);
      p.rotation.y += p.userData.baseRot;

      if (p.userData.ring) p.userData.ring.position.copy(p.position);

      const lab = labels[i];
      if (lab){
        lab.position.set(p.position.x, p.position.y + (p.geometry.parameters.radius||1) + 7, p.position.z);
        lab.lookAt(camera.position);
      }
    });

    // keep camera aimed
    camera.lookAt(lookAtTarget);

    // pin lock card above the focused object
    const obj = focusTargets[focusIndex];
    if (obj && !lockCard.hidden){
      worldToScreen.copy(obj.position).project(camera);
      const x = (worldToScreen.x *  0.5 + 0.5) * window.innerWidth;
      const y = (-worldToScreen.y * 0.5 + 0.5) * window.innerHeight;
      // lift card a bit above planet by subtracting pixels
      lockCard.style.transform = `translate(${Math.round(x-70)}px, ${Math.round(y-80)}px)`; /* visually centered */
    }

    renderer.render(scene, camera);
  }

  // attach singletons used above
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
})();
