/* entryHole.js — Blackhole entry layer
   - If window.createCrazy4Wormhole exists (your library), we use it.
   - Otherwise we render a built-in vortex + UFO spiral + smoke trail.
   Exposes: window.initEntry() and window.playEntry(next)
*/
(function () {
  const SPRITE_URL = "https://threejs.org/examples/textures/sprites/disc.png";

  let renderer, scene, camera, vortex, ufo, smokeGroup, animTL;
  let entryCanvas, entryRoot;

  function ensureRenderer() {
    entryCanvas = document.getElementById("entry-canvas");
    if (!entryCanvas) return null;
    renderer = new THREE.WebGLRenderer({ canvas: entryCanvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    return renderer;
  }

  function makeBuiltInVortex() {
    // A simple swirling shader on a plane to mimic a Dali-esque hole
    const geo = new THREE.PlaneGeometry(40, 40, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        u_time: { value: 0 },
        u_colorA: { value: new THREE.Color(0x0a0f1e) },
        u_colorB: { value: new THREE.Color(0x010103) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float u_time;
        uniform vec3 u_colorA; uniform vec3 u_colorB;

        float spiral(vec2 uv){
          vec2 p = uv - 0.5;
          float r = length(p)*2.0;
          float a = atan(p.y,p.x);
          float s = sin(8.0*a - u_time*1.6);
          return smoothstep(1.2, 0.0, r + s*0.08);
        }
        void main(){
          float v = spiral(vUv);
          vec3 col = mix(u_colorB, u_colorA, v);
          float rim = smoothstep(0.9, 0.4, length(vUv-0.5));
          col *= rim;
          gl_FragColor = vec4(col, 0.95);
        }`
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    return m;
  }

  function makeUFO() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.9, 0.38, 32),
      new THREE.MeshStandardMaterial({ color: 0xaeb6c1, roughness: 0.4, metalness: 0.6 })
    );
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xbfefff, roughness: 0.15, metalness: 0.1, emissive: 0x66ccff, emissiveIntensity: 0.2 })
    );
    dome.scale.set(1, 0.6, 1);
    dome.position.y = 0.45;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.08, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.25, metalness: 0.7 })
    );
    rim.rotation.x = Math.PI/2;

    g.add(hull, dome, rim);
    g.position.set(0, 1.2, 8);
    return g;
  }

  function makeSmoke() {
    const group = new THREE.Group();
    const tex = new THREE.TextureLoader().load(SPRITE_URL);
    for (let i=0;i<40;i++){
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xb0e0d0, opacity: 0.4, transparent:true }));
      s.scale.setScalar(THREE.MathUtils.randFloat(0.3, 0.9));
      s.position.set(0,0,0);
      s.userData.life = Math.random()*1.0;
      group.add(s);
    }
    return group;
  }

  function tickSmoke(dt){
    smokeGroup.children.forEach((s) => {
      s.userData.life += dt*0.6;
      const t = s.userData.life % 1.0;
      s.position.lerp(ufo.position, 0.15);
      s.position.x += (Math.random()-0.5)*0.06;
      s.position.y += (Math.random())*0.02;
      s.position.z += (Math.random()-0.5)*0.06;
      s.material.opacity = 0.45*(1.0 - t);
      s.scale.setScalar(0.2 + 1.1*(1.0 - t));
    });
  }

  function onResize(){
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function animate(){
    if (!renderer) return;
    requestAnimationFrame(animate);
    const t = performance.now()*0.001;
    if (vortex.material?.uniforms?.u_time) vortex.material.uniforms.u_time.value = t;

    ufo.rotation.y += 0.02;
    tickSmoke(1/60);

    renderer.render(scene, camera);
  }

  // PUBLIC
  window.initEntry = function initEntry(){
    entryRoot = document.getElementById("entry");
    if (!ensureRenderer()) return;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02030a, 0.04);
    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 100);
    camera.position.set(0, 3.2, 10);

    // lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.PointLight(0xffffff, 2.0, 0, 2); key.position.set(0,4,8); scene.add(key);

    // vortex (from crazy4 if available)
    if (typeof window.createCrazy4Wormhole === "function") {
      vortex = window.createCrazy4Wormhole(THREE);
    } else {
      vortex = makeBuiltInVortex();
    }
    scene.add(vortex);

    ufo = makeUFO(); scene.add(ufo);
    smokeGroup = makeSmoke(); scene.add(smokeGroup);

    window.addEventListener('resize', onResize);
    animate();
  };

  // Dali-esque takeoff into the hole (spiral + miniaturise + trail)
  window.playEntry = function playEntry(next){
    if (!entryRoot) return next?.();

    const tl = gsap.timeline({ defaults:{ ease:"power2.inOut" }});

    // spiral path to the center
    tl.to(ufo.position, { 
      duration: 2.0,
      // spiral: reduce radius while rotating around center
      onUpdate:function(){
        const p = this.progress();
        const angle = p * Math.PI * 4.0;
        const radius = 8 * (1.0 - p);
        ufo.position.x = Math.cos(angle)*radius;
        ufo.position.z = Math.sin(angle)*radius;
        ufo.position.y = 1.2 + (1.0 - p)*0.6;
      }
    }, 0);

    // shrink & stretch (optical miniaturisation)
    tl.to(ufo.scale, { x:0.2, y:0.2, z:0.2, duration: 1.6 }, 0.4);
    tl.to(ufo.scale, { x:0.05, y:0.05, z:0.05, duration: 0.6 }, 1.6);

    // slight camera dolly for depth parallax
    tl.to(camera.position, { z: 7.0, duration: 1.6 }, 0.2);

    // finish: fade the whole layer out, then hide, then call next()
    tl.to(entryRoot, { autoAlpha: 0, duration: 0.6, onComplete: () => {
      entryRoot.style.display="none";
      next?.();
    }}, 2.2);
  };
})();
