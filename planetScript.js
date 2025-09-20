/* solarSystem.js
 * - Parallax star shells (far, no near fly-bys)
 * - Detailed Sun + textured planets
 * - Scroll/keys lock focus; camera follows orbit
 * - HTML "lock card" pinned above focused body (plus curved sprite on hover)
 */

(function(){
  const TEX = "https://threejs.org/examples/textures/planets";
  const DISC = "https://threejs.org/examples/textures/sprites/disc.png";

  const canvas = document.getElementById('solar-scene');
  const hint   = document.getElementById('hint');
  const tourSkip = document.getElementById('tour-skip');
  const lockCard = document.getElementById('lock-card');
  const lockTitle = document.getElementById('lock-title');
  const lockSub   = document.getElementById('lock-sub');

  let renderer, scene, camera;
  let planets=[], labels=[];
  let sun;
  let raycaster, mouse, hovered=null;
  let focusTargets=[], focusIndex=0;
  const lookAtTarget = new THREE.Vector3(0,0,0);
  const tmpV = new THREE.Vector3();

  let starLayers=[];

  function init(){
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 8000);
    camera.position.set(0, 140, 520);

    addParallaxStars();

    const ambient = new THREE.AmbientLight(0xffffff, .55);
    const sunLight= new THREE.PointLight(0xffffff, 2.4, 0, 2);
    sunLight.position.set(0,0,0);
    scene.add(ambient, sunLight);

    sun = buildSun();
    scene.add(sun);

    // planets (spaced, slowed)
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

    // orbit rings
    PLANETS.forEach(p => addOrbit(p.orbit));

    // build planets
    const loader = new THREE.TextureLoader();
    PLANETS.forEach((cfg,i)=>{
      const mat = makePlanetMaterial(cfg.tex, cfg.color);
      const mesh= new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 64,64), mat);
      mesh.userData = {
        name:cfg.name, url:cfg.url, label:cfg.label,
        orbit:cfg.orbit, speed:cfg.speed,
        angle:i*0.85+0.3, baseRot:0.002 + Math.random()*0.004
      };
      mesh.position.set(Math.cos(mesh.userData.angle)*cfg.orbit, 0, Math.sin(mesh.userData.angle)*cfg.orbit);
      scene.add(mesh);
      planets.push(mesh);

      const sprite = makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 220);
      sprite.scale.set(18, 9, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size+7, 0));
      scene.add(sprite);
      labels.push(sprite);

      if (cfg.name==='Saturn'){
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cfg.size*1.2, cfg.size*2.2, 96),
          new THREE.MeshBasicMaterial({ side:THREE.DoubleSide, transparent:true, color:0xffffff })
        );
        loader.load(`${TEX}/saturnringcolor.jpg`, (t)=>{ ring.material.map=t; ring.material.needsUpdate=true; });
        loader.load(`${TEX}/saturnringpattern.gif`,(t)=>{ ring.material.alphaMap=t; ring.material.needsUpdate=true; });
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
    window.addEventListener('resize', onResize);
    window.addEventListener('wheel', onWheel, { passive:false });
    window.addEventListener('keydown', onKey);

    // focus list
    focusTargets = [sun, ...planets];

    // animate
    animate();
  }

  function addParallaxStars(){
    // 3 shells with different radii & speeds; round sprite points
    const tex = new THREE.TextureLoader().load(DISC);
    const layerDefs = [
      { count: 2200, rMin: 700,  rMax: 1000, size:1.6, speed: 0.0004 },
      { count: 2600, rMin: 1000, rMax: 1400, size:1.4, speed: 0.00025 },
      { count: 3000, rMin: 1400, rMax: 1900, size:1.2, speed: 0.00015 }
    ];
    layerDefs.forEach(def=>{
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(def.count*3);
      for(let i=0;i<def.count;i++){
        const r = THREE.MathUtils.randFloat(def.rMin, def.rMax);
        const th = Math.acos(THREE.MathUtils.randFloatSpread(2));
        const ph = Math.random()*Math.PI*2;
        positions[i*3]   = r*Math.sin(th)*Math.cos(ph);
        positions[i*3+1] = r*Math.cos(th);
        positions[i*3+2] = r*Math.sin(th)*Math.sin(ph);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
      const mat = new THREE.PointsMaterial({
        map: tex, size:def.size, sizeAttenuation:true,
        color:0xffffff, transparent:true, alphaTest:.45, depthWrite:false, opacity:.95
      });
      const pts = new THREE.Points(geo,mat);
      pts.userData.speed = def.speed;
      starLayers.push(pts);
      scene.add(pts);
    });
  }

  function buildSun(){
    const g = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const mat = new THREE.MeshBasicMaterial({
      map: loader.load(`${TEX}/sun.jpg`),
      emissive: 0xffaa33, emissiveIntensity: .6
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(18,64,64), mat);
    g.add(s);

    // halo
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 256;
    const c = cvs.getContext('2d');
    const grd = c.createRadialGradient(128,128,0, 128,128,128);
    grd.addColorStop(0,'rgba(255,200,80,.45)');
    grd.addColorStop(1,'rgba(255,200,80,0)');
    c.fillStyle=grd; c.fillRect(0,0,256,256);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cvs), transparent:true, depthWrite:false }));
    halo.scale.set(80,80,1);
    g.add(halo);
    g.name = 'Sun';
    return g;
  }

  function addOrbit(radius){
    const segs = 256, pts=[];
    for(let i=0;i<=segs;i++){
      const a = (i/segs)*Math.PI*2;
      pts.push(new THREE.Vector3(Math.cos(a)*radius,0,Math.sin(a)*radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color:0x223344, transparent:true, opacity:.35 });
    scene.add(new THREE.LineLoop(geo, mat));
  }

  function makePlanetMaterial(url, fallbackColor=0x888888){
    const loader = new THREE.TextureLoader();
    const m = new THREE.MeshStandardMaterial({ color:fallbackColor, roughness:1, metalness:0 });
    loader.load(url, (tx)=>{ m.map=tx; m.needsUpdate=true; });
    return m;
  }

  function makeCurvedLabel(text, diameterPx=200){
    const pad=24, size=diameterPx+pad*2;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0,0,size,size);
    ctx.translate(size/2,size/2);
    const radius = diameterPx/2;
    const chars = [...text];
    ctx.font = `800 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "#ffeeb0";
    ctx.shadowColor = "rgba(255,200,80,.35)";
    ctx.shadowBlur = 12;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const arc = Math.PI*0.9;
    const step= arc/Math.max(chars.length,1);
    let ang = -arc/2;
    for(const ch of chars){
      ctx.save(); ctx.rotate(ang); ctx.translate(0,-radius); ctx.rotate(-Math.PI/2);
      ctx.fillText(ch,0,0); ctx.restore(); ang += step;
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy=8;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, opacity:0 }));
  }

  // ===== overview → lock Mercury =====
  window.startWelcomeSequence = function startWelcomeSequence(){
    // show overview briefly
    camera.position.set(0, 170, 620);
    camera.lookAt(0,0,0);
    if (tourSkip) tourSkip.hidden = false;
    const goFirst = ()=>{
      if (tourSkip){ tourSkip.hidden = true; tourSkip.onclick = null; }
      focusOn(1); // Mercury
    };
    if (tourSkip){
      tourSkip.onclick = goFirst;
      gsap.delayedCall(2.0, goFirst);
    }else{
      gsap.delayedCall(1.6, goFirst);
    }
  };

  // ===== focus logic (Sun=0, Mercury=1, …) =====
  function focusOn(index){
    focusIndex = THREE.MathUtils.clamp(index, 0, focusTargets.length-1);
    const obj = focusTargets[focusIndex];
    const radius = obj.geometry?.parameters?.radius || 6;
    const dist   = radius*5.6;
    const height = radius*2.3;

    const targetPos = obj.position.clone();
    const dest = targetPos.clone().add(new THREE.Vector3(0,height,dist));

    gsap.to(camera.position, { x:dest.x, y:dest.y, z:dest.z, duration:.85, ease:'power2.out' });
    gsap.to(lookAtTarget,   { x:targetPos.x, y:targetPos.y, z:targetPos.z, duration:.85, ease:'power2.out' });

    // show lock card
    setLockCard(obj);
  }

  function setLockCard(obj){
    lockTitle.textContent = obj.name || (obj.userData?.name ?? 'Sun');
    lockSub.textContent   = obj.userData?.label || (obj===sun ? 'Home' : '');
    lockCard.hidden = false;
    // pop-in
    lockCard.classList.add('show');
  }

  function hideLockCard(){
    lockCard.classList.remove('show');
    lockCard.hidden = true;
  }

  // ===== interactions =====
  function setLabelVisible(sprite, visible){
    const target = visible ? 1 : 0;
    if (!sprite || sprite.material.opacity === target) return;
    gsap.to(sprite.material, { opacity:target, duration:.25, ease:'power2.out' });
  }

  function onPointerMove(e){
    mouse.x = (e.clientX/window.innerWidth)*2 - 1;
    mouse.y = -(e.clientY/window.innerHeight)*2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets, false);
    if (hits.length){
      const obj = hits[0].object;
      if (hovered !== obj){
        if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
        hovered = obj;
        setLabelVisible(labels[planets.indexOf(obj)], true);
        document.body.style.cursor = 'pointer';
      }
    }else{
      if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
      hovered = null; document.body.style.cursor = 'default';
    }
  }

  function onClick(){
    if (!hovered) return;
    const url = hovered.userData?.url;
    if (url) window.location.href = url;
  }

  let lastWheel=0;
  function onWheel(e){
    e.preventDefault();
    const now = performance.now();
    if (now-lastWheel < 420) return; // debounce
    lastWheel = now;
    focusOn(focusIndex + (e.deltaY>0 ? 1 : -1));
  }

  function onKey(e){
    if (e.key==='ArrowRight') focusOn(focusIndex+1);
    if (e.key==='ArrowLeft')  focusOn(focusIndex-1);
    if (e.key==='Enter' && focusTargets[focusIndex]?.userData?.url){
      window.location.href = focusTargets[focusIndex].userData.url;
    }
  }

  function onResize(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ===== animation =====
  function animate(){
    requestAnimationFrame(animate);

    // gentle star parallax (rotate layer around tiny axis)
    starLayers.forEach((L,i)=>{
      L.rotation.y += L.userData.speed || 0.0002;
    });

    // sun idle
    if (sun) sun.rotation.y += 0.0015;

    // planet motion + labels & rings follow
    planets.forEach((p,i)=>{
      p.userData.angle += p.userData.speed;
      const r = p.userData.orbit;
      p.position.set(Math.cos(p.userData.angle)*r, 0, Math.sin(p.userData.angle)*r);
      p.rotation.y += p.userData.baseRot;
      if (p.userData.ring) p.userData.ring.position.copy(p.position);

      const label = labels[i];
      if (label){
        const h = (p.geometry.parameters.radius||1) + 7;
        label.position.set(p.position.x, p.position.y + h, p.position.z);
        label.lookAt(camera.position);
      }
    });

    // keep camera aimed at current target (smooth)
    camera.lookAt(lookAtTarget);

    // position the HTML lock card above the focused target
    const obj = focusTargets[focusIndex];
    if (obj){
      const radius = obj.geometry?.parameters?.radius || 6;
      tmpV.copy(obj.position).add(new THREE.Vector3(0, radius+7, 0));
      // world → NDC → screen
      tmpV.project(camera);
      const sx = ( tmpV.x *  0.5 + 0.5) * window.innerWidth;
      const sy = (-tmpV.y *  0.5 + 0.5) * window.innerHeight;
      lockCard.style.left = `${sx}px`;
      lockCard.style.top  = `${sy}px`;
      // show only when in front of camera
      const visible = tmpV.z < 1 && tmpV.z > -1;
      lockCard.style.display = visible ? 'block' : 'none';
    }

    renderer.render(scene, camera);
  }

  // boot
  document.addEventListener('DOMContentLoaded', ()=>{
    raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();
    init();
  });
})();
