/* planetScript.js — Solar system + scroll-lock + pinned card
   Exposes:
     window.initSolarSystem()
     window.startWelcomeSequence()  // brief overview → focus Mercury
*/
(function(){
  const TEX = "https://threejs.org/examples/textures/planets";
  const STAR_SPRITE = "https://threejs.org/examples/textures/sprites/disc.png";

  let renderer, scene, camera, raycaster, mouse;
  let sun, planets=[], labels=[];
  let focusTargets=[], focusIndex=0, lookAtTarget=new THREE.Vector3();
  let lockCard, lockTitle, lockSub, lockedAnchor=new THREE.Vector3();
  let hint, skipBtn;

  // ---------- helpers ----------
  function getCanvas() {
    let c = document.getElementById("solar-scene");
    if (!c){ c = document.createElement("canvas"); c.id="solar-scene"; document.body.appendChild(c); }
    return c;
  }
  function makeStars({ count=5000, rMin=700, rMax=1300, size=1.8 }={}){
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const r=THREE.MathUtils.randFloat(rMin,rMax);
      const theta=Math.acos(THREE.MathUtils.randFloatSpread(2));
      const phi=Math.random()*Math.PI*2;
      pos[i*3]   = r*Math.sin(theta)*Math.cos(phi);
      pos[i*3+1] = r*Math.cos(theta);
      pos[i*3+2] = r*Math.sin(theta)*Math.sin(phi);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos,3));
    const tex=new THREE.TextureLoader().load(STAR_SPRITE);
    const mat=new THREE.PointsMaterial({
      map:tex, size, sizeAttenuation:true, color:0xffffff,
      transparent:true, alphaTest:0.45, depthWrite:false, opacity:0.95
    });
    return new THREE.Points(geo,mat);
  }
  function makeCurvedLabel(text, diameterPx=220){
    const pad=24, size=diameterPx+pad*2;
    const cvs=document.createElement("canvas"); cvs.width=cvs.height=size;
    const ctx=cvs.getContext("2d");
    ctx.translate(size/2,size/2);
    const radius=diameterPx/2, chars=[...text];
    ctx.font=`800 26px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    ctx.fillStyle="#ffeeb0"; ctx.shadowColor="rgba(255,200,80,.35)"; ctx.shadowBlur=12;
    ctx.textBaseline="middle"; ctx.textAlign="center";
    const arc=Math.PI*0.9, step=arc/Math.max(chars.length,1); let a=-arc/2;
    for(const ch of chars){ ctx.save(); ctx.rotate(a); ctx.translate(0,-radius); ctx.rotate(-Math.PI/2); ctx.fillText(ch,0,0); ctx.restore(); a+=step; }
    const tex=new THREE.CanvasTexture(cvs); tex.anisotropy=8;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, opacity:0 }));
  }
  function makePlanetMaterial(url, fallbackColor=0x888888){
    const loader=new THREE.TextureLoader();
    const mat=new THREE.MeshStandardMaterial({ color:fallbackColor, roughness:1, metalness:0 });
    loader.load(url,(tx)=>{ mat.map=tx; mat.needsUpdate=true; });
    return mat;
  }
  function buildSun(){
    const g=new THREE.Group();
    const loader=new THREE.TextureLoader();
    const sunMat=new THREE.MeshBasicMaterial({ map: loader.load(`${TEX}/sun.jpg`) });
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(18,64,64), sunMat);
    g.add(sphere);
    // halo
    const cvs=document.createElement("canvas"); cvs.width=cvs.height=256;
    const c=cvs.getContext("2d"), grad=c.createRadialGradient(128,128,0,128,128,128);
    grad.addColorStop(0,"rgba(255,200,80,0.45)"); grad.addColorStop(1,"rgba(255,200,80,0.0)");
    c.fillStyle=grad; c.fillRect(0,0,256,256);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cvs), transparent:true, depthWrite:false }));
    glow.scale.set(80,80,1); g.add(glow);
    g.name="Sun"; return g;
  }
  function addOrbit(radius){
    const segs=256, pts=[];
    for(let i=0;i<=segs;i++){ const a=(i/segs)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*radius,0,Math.sin(a)*radius)); }
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const mat=new THREE.LineBasicMaterial({ color:0x223344, transparent:true, opacity:0.35 });
    scene.add(new THREE.LineLoop(geo,mat));
  }
  function worldToScreen(pos){
    const width=renderer.domElement.clientWidth, height=renderer.domElement.clientHeight;
    const p=pos.clone().project(camera);
    return { x:(p.x*0.5+0.5)*width, y:(-p.y*0.5+0.5)*height };
  }

  // ---------- public: init ----------
  window.initSolarSystem = function initSolarSystem(){
    const canvas=getCanvas();
    renderer=new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene=new THREE.Scene();
    // leave background black so stars show through clearly
    scene.add(makeStars());

    camera=new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 8000);
    camera.position.set(0, 120, 420);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sunLight=new THREE.PointLight(0xffffff, 2.2, 0, 2); sunLight.position.set(0,0,0); scene.add(sunLight);

    sun=buildSun(); scene.add(sun);

    const PLANETS=[
      { name:"Mercury", tex:`${TEX}/mercury.jpg`,              color:0x9c9c9c, size:2.2, orbit: 46,  speed:0.010, url:"about.html",       label:"About"   },
      { name:"Venus",   tex:`${TEX}/venus.jpg`,                color:0xd8b57a, size:3.5, orbit: 66,  speed:0.008, url:"writing.html",     label:"Writing" },
      { name:"Earth",   tex:`${TEX}/earth_atmos_2048.jpg`,     color:0x5aa0ff, size:3.7, orbit: 86,  speed:0.007, url:"projects.html",    label:"Projects"},
      { name:"Mars",    tex:`${TEX}/mars_1k_color.jpg`,        color:0xb55a3c, size:3.0, orbit:110,  speed:0.006, url:"photography.html", label:"Photos"  },
      { name:"Jupiter", tex:`${TEX}/jupiter2_1024.jpg`,        color:0xe0c7a2, size:8.5, orbit:150,  speed:0.004, url:"resume.html",      label:"Resume"  },
      { name:"Saturn",  tex:`${TEX}/saturn.jpg`,               color:0xdcc7a0, size:7.5, orbit:200,  speed:0.004, url:"contact.html",     label:"Contact" },
      { name:"Uranus",  tex:`${TEX}/uranus.jpg`,               color:0x88e0e8, size:6.0, orbit:250,  speed:0.003, url:"links.html",       label:"Links"   },
      { name:"Neptune", tex:`${TEX}/neptune.jpg`,              color:0x4a6eff, size:5.8, orbit:290,  speed:0.003, url:"blog.html",        label:"Blog"    },
    ];

    planets=[]; labels=[];
    PLANETS.forEach(p=>addOrbit(p.orbit));

    const loader=new THREE.TextureLoader();
    PLANETS.forEach((cfg,i)=>{
      const mat=makePlanetMaterial(cfg.tex, cfg.color);
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(cfg.size,64,64), mat);
      mesh.userData={ name:cfg.name, url:cfg.url, label:cfg.label, orbit:cfg.orbit, speed:cfg.speed,
        angle:i*0.85+0.3, baseRot:0.002+Math.random()*0.004 };
      mesh.position.set(Math.cos(mesh.userData.angle)*cfg.orbit, 0, Math.sin(mesh.userData.angle)*cfg.orbit);
      scene.add(mesh); planets.push(mesh);

      const sprite=makeCurvedLabel(`${cfg.name} • ${cfg.label}`, 220);
      sprite.scale.set(18,9,1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, cfg.size+7, 0));
      scene.add(sprite); labels.push(sprite);

      if (cfg.name==="Saturn"){
        const ring=new THREE.Mesh(
          new THREE.RingGeometry(cfg.size*1.2, cfg.size*2.2, 96),
          new THREE.MeshBasicMaterial({ side:THREE.DoubleSide, transparent:true, color:0xffffff })
        );
        loader.load(`${TEX}/saturnringcolor.jpg`, t=>{ ring.material.map=t; ring.material.needsUpdate=true; });
        loader.load(`${TEX}/saturnringpattern.gif`, t=>{ ring.material.alphaMap=t; ring.material.needsUpdate=true; });
        ring.rotation.x = -Math.PI/2; ring.position.copy(mesh.position); scene.add(ring);
        mesh.userData.ring=ring;
      }
    });

    // HUD refs
    hint=document.getElementById("hint");
    skipBtn=document.getElementById("tour-skip");
    lockCard=document.getElementById("lock-card");
    lockTitle=document.getElementById("lock-title");
    lockSub=document.getElementById("lock-sub");

    // Focus system
    focusTargets=[sun, ...planets];
    focusIndex=0;

    // Interactions
    raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("click", onClick);
    window.addEventListener("wheel", onWheel, { passive:false });
    window.addEventListener("keydown", onKeys);
    window.addEventListener("resize", onResize);

    gsap.to(hint, { opacity: 1, delay: 1.0, duration:.5 });

    animate();
  };

  // ---------- overview → Mercury ----------
  window.startWelcomeSequence = function startWelcomeSequence(){
    if (skipBtn) skipBtn.hidden=false;

    // start far, quick dolly, then focus Mercury
    camera.position.set(0, 160, 560);
    gsap.to(camera.position, { z: 420, duration: 1.2, ease:"power1.out" });

    const goFirst = () => { focusOn(1); if (skipBtn){ skipBtn.hidden=true; skipBtn.onclick=null; } };
    skipBtn.onclick = goFirst;
    gsap.delayedCall(1.6, goFirst);
  };

  // ---------- focus / lock ----------
  function focusOn(index){
    focusIndex = THREE.MathUtils.clamp(index, 0, focusTargets.length-1);
    const obj = focusTargets[focusIndex];

    const radius = obj.geometry?.parameters?.radius || 6;
    const dist   = radius * 5.5;
    const height = radius * 2.2;

    const targetPos = obj.position.clone();
    const dest = targetPos.clone().add(new THREE.Vector3(0,height,dist));

    gsap.to(camera.position, { x:dest.x, y:dest.y, z:dest.z, duration:0.8, ease:"power2.out" });
    gsap.to(lookAtTarget,     { x:targetPos.x, y:targetPos.y, z:targetPos.z, duration:0.8, ease:"power2.out" });

    // show the lock card (not for the Sun)
    if (lockCard){
      if (obj === sun){
        lockCard.hidden = true;
      } else {
        const pi = focusIndex-1; // planets array index
        lockTitle.textContent = planets[pi].userData.name;
        lockSub.textContent   = planets[pi].userData.label;
        lockCard.hidden = false;
      }
    }
  }

  function onWheel(e){
    e.preventDefault();
    focusOn(focusIndex + (e.deltaY > 0 ? 1 : -1));
  }
  function onKeys(e){
    if (e.key==="ArrowRight") focusOn(focusIndex+1);
    if (e.key==="ArrowLeft")  focusOn(focusIndex-1);
  }

  // ---------- hover labels + click ----------
  let hovered=null;
  function setLabelVisible(sprite, visible){
    const target = visible ? 1 : 0;
    if (!sprite || sprite.material.opacity===target) return;
    gsap.to(sprite.material, { opacity: target, duration: 0.25, ease: "power2.out" });
  }
  function onPointerMove(e){
    mouse.x = (e.clientX/window.innerWidth)*2 - 1;
    mouse.y = -(e.clientY/window.innerHeight)*2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(planets, false);

    if (hits.length){
      const obj=hits[0].object;
      if (hovered!==obj){
        if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
        hovered=obj;
        setLabelVisible(labels[planets.indexOf(obj)], true);
        document.body.style.cursor="pointer";
      }
    } else {
      if (hovered) setLabelVisible(labels[planets.indexOf(hovered)], false);
      hovered=null; document.body.style.cursor="default";
    }
  }
  function onClick(){
    if (!hovered) return;
    const url = hovered.userData.url;
    if (url) window.location.href = url;
  }

  function onResize(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  }

  // ---------- render loop ----------
  function animate(){
    requestAnimationFrame(animate);

    if (sun) sun.rotation.y += 0.002;

    planets.forEach((p,i)=>{
      p.userData.angle += p.userData.speed;
      const r=p.userData.orbit;
      p.position.set(Math.cos(p.userData.angle)*r, 0, Math.sin(p.userData.angle)*r);
      p.rotation.y += p.userData.baseRot;
      if (p.userData.ring) p.userData.ring.position.copy(p.position);

      const sprite=labels[i];
      if (sprite){
        const h=(p.geometry.parameters.radius||1)+7;
        sprite.position.set(p.position.x, p.position.y + h, p.position.z);
        sprite.lookAt(camera.position);
      }
    });

    // keep camera looking at current target
    camera.lookAt(lookAtTarget);

    // position the HTML lock-card above the focused planet
    if (lockCard && !lockCard.hidden && focusIndex>0){
      const p = planets[focusIndex-1];
      lockedAnchor.copy(p.position).add(new THREE.Vector3(0,(p.geometry.parameters.radius||1)+9,0));
      const {x,y} = worldToScreen(lockedAnchor);
      lockCard.style.left = `${x}px`;
      lockCard.style.top  = `${y}px`;
    }

    renderer.render(scene, camera);
  }
})();
