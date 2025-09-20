/* entryBlackhole.js
 * Black-hole entry: wormhole + UFO that miniaturises along the trajectory,
 * leaving a smoke trail. When done, fades this canvas and calls onComplete().
 * 
 * If you have your own "crazy-4" tunnel implementation, drop it as
 *   ./crazy4-wormhole.js  exporting createWormhole(scene, camera, renderer)
 * This file will auto-use it if found, else it runs the built-in blackhole.
 */

(function () {
  const ENTRY_ID = 'entry-canvas';
  const STAR_SPRITE = "https://threejs.org/examples/textures/sprites/disc.png";

  // ---- helpers -------------------------------------------------------------
  function makeRenderer(canvas){
    const r = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    return r;
  }

  function onResize(renderer, camera){
    function resize(){
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();
  }

  // Round sprite loader (for stars and smoke)
  function makeCircleSprite(size=256, centerAlpha=0.9, edgeAlpha=0.0){
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d');
    const g = ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
    g.addColorStop(0, `rgba(255,255,255,${centerAlpha})`);
    g.addColorStop(1, `rgba(255,255,255,${edgeAlpha})`);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.arc(size/2,size/2,size/2,0,Math.PI*2); ctx.fill();
    const tex = new THREE.CanvasTexture(cvs);
    tex.anisotropy = 4;
    return tex;
  }

  // ---- UFO (simple but elegant) -------------------------------------------
  function buildUFO(){
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.2, 0.72, 48),
      new THREE.MeshStandardMaterial({ color: 0xaeb6c1, roughness: 0.4, metalness: 0.6 })
    );
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 36, 24),
      new THREE.MeshStandardMaterial({ color: 0xc5f2ff, roughness: 0.15, metalness: 0.05, emissive: 0x66ccff, emissiveIntensity: 0.18 })
    );
    dome.scale.set(1, 0.58, 1);
    dome.position.y = 0.75;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.14, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.22, metalness: 0.7 })
    );
    ring.rotation.x = Math.PI/2;

    // soft glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeCircleSprite(256, 0.32, 0.0), transparent:true, depthWrite:false }));
    glow.scale.set(8,8,1);
    glow.position.y = -0.25;

    // windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0xffe36d, emissive: 0xffe36d, emissiveIntensity: 0.9 });
    for(let i=0;i<5;i++){
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), winMat);
      const a = i*(Math.PI*2/5);
      w.position.set(Math.cos(a)*2.6, 0.12, Math.sin(a)*2.6);
      w.rotation.x = -Math.PI/2;
      g.add(w);
    }

    g.add(hull,dome,ring,glow);
    g.name='UFO';
    return g;
  }

  // ---- Built-in blackhole (accretion disc + vortex + parallax stars) ------
  function addParallaxStars(scene){
    const loader = new THREE.TextureLoader();
    const sprite = loader.load(STAR_SPRITE);
    const shells = [];
    const layers = [
      { count: 2200, rMin: 800, rMax: 1400, size: 1.4, rot:  0.0003 },
      { count: 1400, rMin: 1000, rMax: 1800, size: 1.8, rot: -0.0002 },
      { count: 800,  rMin: 1400, rMax: 2400, size: 2.2, rot:  0.00015 },
    ];
    layers.forEach(L=>{
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(L.count*3);
      for(let i=0;i<L.count;i++){
        const r   = THREE.MathUtils.randFloat(L.rMin, L.rMax);
        const th  = Math.acos(THREE.MathUtils.randFloatSpread(2));
        const ph  = Math.random()*Math.PI*2;
        pos[i*3]   = r*Math.sin(th)*Math.cos(ph);
        pos[i*3+1] = r*Math.cos(th);
        pos[i*3+2] = r*Math.sin(th)*Math.sin(ph);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
      const mat = new THREE.PointsMaterial({ map:sprite, size:L.size, sizeAttenuation:true, transparent:true, alphaTest:.45, opacity:.95, depthWrite:false, color:0xffffff });
      const pts = new THREE.Points(geo, mat);
      pts.userData.rot = L.rot;
      scene.add(pts); shells.push(pts);
    });
    return shells;
  }

  function addAccretionDisc(scene){
    const loader = new THREE.TextureLoader();
    const texture = makeCircleSprite(256, 0.75, 0.0);
    const count = 3500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count*3);
    const col = new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const r = THREE.MathUtils.randFloat(8, 42);
      const a = Math.random()*Math.PI*2;
      pos[i*3]   = Math.cos(a)*r;
      pos[i*3+1] = THREE.MathUtils.randFloatSpread(0.35);
      pos[i*3+2] = Math.sin(a)*r;
      // warm surreal palette
      col[i*3]   = 1.0;       // r
      col[i*3+1] = 0.84;      // g
      col[i*3+2] = 0.45;      // b
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    const mat = new THREE.PointsMaterial({ map:texture, size: 0.9, sizeAttenuation:true, vertexColors:true, transparent:true, opacity:0.95, depthWrite:false });
    const disc = new THREE.Points(geo, mat);
    disc.rotation.x = -Math.PI/2;
    scene.add(disc);
    return disc;
  }

  function addVortex(scene){
    // swirl of particles spiralling inward (gives the “funnel” cue)
    const texture = makeCircleSprite(256, 0.6, 0.0);
    const count = 2800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count*3);
    const a0  = new Float32Array(count);
    const r0  = new Float32Array(count);
    for(let i=0;i<count;i++){
      a0[i] = Math.random()*Math.PI*2;
      r0[i] = THREE.MathUtils.randFloat(3, 26);
      pos[i*3]   = Math.cos(a0[i])*r0[i];
      pos[i*3+1] = THREE.MathUtils.randFloat(-18, 18);
      pos[i*3+2] = Math.sin(a0[i])*r0[i];
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('a0', new THREE.BufferAttribute(a0,1));
    geo.setAttribute('r0', new THREE.BufferAttribute(r0,1));
    const mat = new THREE.PointsMaterial({ map:texture, size: 0.7, sizeAttenuation:true, transparent:true, opacity:0.9, depthWrite:false, color:0xdbc8ff });
    const swarm = new THREE.Points(geo, mat);
    scene.add(swarm);

    // animate in tick: advance phase so points spiral inward
    swarm.userData.update = (t)=>{
      const p = geo.getAttribute('position');
      const a = geo.getAttribute('a0');
      const r = geo.getAttribute('r0');
      for(let i=0;i<p.count;i++){
        const radius = Math.max(0.4, r.getX(i) - 0.006*t);
        const angle  = a.getX(i) + 0.035*t/r.getX(i);
        p.setXYZ(i, Math.cos(angle)*radius, p.getY(i)*0.999, Math.sin(angle)*radius);
      }
      p.needsUpdate = true;
    };
    return swarm;
  }

  // smoke particle system (tiny pool)
  function makeSmokeSystem(scene){
    const tex = makeCircleSprite(256, 0.35, 0.0);
    const pool = [];
    const alive = [];
    for(let i=0;i<220;i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, opacity:0 }));
      s.scale.set(1,1,1);
      scene.add(s); pool.push(s);
    }
    return {
      emit:(pos, dir)=>{
        if(!pool.length) return;
        const s = pool.pop();
        s.position.copy(pos);
        const v = dir.clone().multiplyScalar(-1).multiplyScalar(THREE.MathUtils.randFloat(0.6,1.3));
        v.x += THREE.MathUtils.randFloatSpread(0.3);
        v.y += THREE.MathUtils.randFloatSpread(0.2);
        v.z += THREE.MathUtils.randFloatSpread(0.3);
        const life = THREE.MathUtils.randFloat(0.6, 1.3);
        const scale = THREE.MathUtils.randFloat(0.6, 1.2);
        s.scale.set(scale,scale,1);
        s.material.opacity = 0.0;
        alive.push({s, v, t:0, life});
      },
      update:(dt)=>{
        for(let i=alive.length-1;i>=0;i--){
          const it = alive[i];
          it.t += dt;
          const k = it.t/it.life;
          if(k>=1){
            it.s.material.opacity = 0;
            pool.push(it.s);
            alive.splice(i,1);
            continue;
          }
          it.s.position.addScaledVector(it.v, dt);
          it.s.material.opacity = (1-k)*0.6;
          const sc = it.s.scale.x*(1+dt*0.3);
          it.s.scale.set(sc, sc, 1);
        }
      }
    };
  }

  // ---- main entry ----------------------------------------------------------
  window.startEntry = async function startEntry({ onComplete } = {}){
    const canvas = document.getElementById(ENTRY_ID);
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 8000);
    camera.position.set(0, 16, 90);
    camera.lookAt(0,0,0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const key = new THREE.PointLight(0xffffff, 2.0, 0, 2);
    scene.add(ambient, key);

    onResize(renderer, camera);

    // Prefer user's Crazy-4 wormhole if present
    let usedCrazy4 = false;
    try {
      const mod = await import('./crazy4-wormhole.js'); // << drop-in from your zip if you have it
      if (mod && typeof mod.createWormhole === 'function') {
        mod.createWormhole(scene, camera, renderer);
        usedCrazy4 = true;
      }
    } catch (e) { /* fallback to built-in below */ }

    const layers = usedCrazy4 ? [] : addParallaxStars(scene);
    const disc   = usedCrazy4 ? null : addAccretionDisc(scene);
    const vortex = usedCrazy4 ? null : addVortex(scene);

    // UFO + smoke
    const ufo = buildUFO();
    ufo.position.set(18, 9, 55);
    scene.add(ufo);
    const smoke = makeSmokeSystem(scene);

    // Animate: curve into black hole center (0,0,0) and miniaturise
    const target = new THREE.Vector3(0,0,0);
    const pathMid = new THREE.Vector3(4, 2, 20);
    const t0 = { k: 0 };
    const dir = new THREE.Vector3();

    gsap.to(t0, {
      k: 1, duration: 2.4, ease: "power2.inOut",
      onUpdate: ()=>{
        // quadratic bezier
        const k = t0.k, ik = 1-k;
        const x = ik*ik*ufo.position.x + 2*ik*k*pathMid.x + k*k*target.x;
        const y = ik*ik*ufo.position.y + 2*ik*k*pathMid.y + k*k*target.y;
        const z = ik*ik*ufo.position.z + 2*ik*k*pathMid.z + k*k*target.z;

        // direction for smoke
        dir.set(x - ufo.position.x, y - ufo.position.y, z - ufo.position.z).normalize();
        ufo.position.set(x,y,z);
        ufo.lookAt(target);
        ufo.rotation.y += 0.02;

        // leave smoke
        for(let i=0;i<3;i++) smoke.emit(ufo.position, dir);

        // shrink as it approaches
        const s = THREE.MathUtils.lerp(1, 0.08, k);
        ufo.scale.set(s,s,s);
      },
      onComplete: ()=>{
        // fade entry out, reveal solar scene, call onComplete
        gsap.to(canvas, {
          opacity: 0, duration: 0.6, ease: "power1.out",
          onComplete: ()=>{
            canvas.style.display = 'none';
            const main = document.getElementById('solar-scene');
            main.classList.remove('hidden');
            document.getElementById('hint')?.classList.remove('hidden');
            if (onComplete) onComplete();
          }
        });
      }
    });

    // tick
    let last = performance.now();
    (function animate(){
      requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now-last)/1000); last = now;

      // layers gentle rotation
      for(const s of layers){ s.rotation.y += s.userData.rot; }
      if (vortex && vortex.userData.update) vortex.userData.update(now*0.001*60);

      smoke.update(dt);
      renderer.render(scene, camera);
    })();
  };
})();
