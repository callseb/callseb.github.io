/* ENTRY — wormhole shader + alien button takeoff */
(() => {
  const entry = document.getElementById('entry');
  const canvas = document.getElementById('entry-wormhole');
  const startBtn = document.getElementById('alien-start');

  let renderer, scene, camera, mesh, uniforms, smokeSys;

  function initWormhole() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geom = new THREE.PlaneBufferGeometry(2,2);
    uniforms = {
      u_time: { value: 0 },
      u_aspect: { value: window.innerWidth / window.innerHeight },
      u_intensity: { value: 1.0 }
    };

    // Dalí-esque “crazy wormhole” swirling into a singularity
    const mat = new THREE.ShaderMaterial({
      uniforms,
      fragmentShader: `
        precision highp float;
        uniform float u_time;
        uniform float u_aspect;
        uniform float u_intensity;

        // hash + noise for marbling
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(in vec2 p){
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i+vec2(1.,0.));
          float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
        }

        void main(){
          vec2 uv = gl_FragCoord.xy / vec2( min(gl_FragCoord.w,1.0) ); // not used, but keeps precision hints happy
          vec2 p = (gl_FragCoord.xy / vec2(textureSize)) * 2.0 - 1.0;
        }
      `,
      // (we’ll swap in real shader below)
    });

    // Real fragment shader (separate for clarity)
    mat.fragmentShader = `
      precision highp float;
      uniform float u_time;
      uniform float u_aspect;
      uniform float u_intensity;

      // polar swirl into black hole
      float sdCircle(vec2 p, float r){ return length(p)-r; }

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(in vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.));
        float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / vec2(${window.innerWidth.toFixed(1)}, ${window.innerHeight.toFixed(1)});
        vec2 p = (uv - .5) * vec2(u_aspect,1.0) * 2.0;

        float r = length(p);
        float a = atan(p.y, p.x);

        // spiral flow
        float t = u_time * 0.25;
        float swirl = a + 10.0/(r+0.35) + t*1.4;

        // marbled filaments
        float fil = noise(vec2(swirl*1.2, r*6.0 - t*2.0));
        float glow = smoothstep(.9, 1.2, fil + .15*sin(6.0*r - t*4.0));

        // black hole core (event horizon)
        float hole = smoothstep(0.22, 0.24, r);
        float coreShadow = 1.0 - smoothstep(0.0, 0.22, r);

        // palette: neon green → teal → indigo
        vec3 c1 = vec3(0.70, 1.00, 0.70);
        vec3 c2 = vec3(0.20, 0.95, 0.75);
        vec3 c3 = vec3(0.20, 0.25, 0.85);
        vec3 col = mix(c3, mix(c2, c1, glow), smoothstep(0.0, 1.0, 1.0-r));

        // darken toward hole, add rim
        col *= mix(1.0, 0.1, coreShadow);
        col += 0.12 * smoothstep(0.24, 0.245, r);

        // vignette
        float vig = smoothstep(1.6, 0.2, length(p));
        col *= vig;

        // intensity
        col *= u_intensity;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    // simple smoke system (sprites) to use in the takeoff
    smokeSys = buildSmokeSystem();
    scene.add(smokeSys.group);

    window.addEventListener('resize', onResize);
    animate();
  }

  function buildSmokeSystem(){
    const group = new THREE.Group();
    const COUNT = 140;
    const tex = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png'); // round sprite
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT*3);
    const sizes = new Float32Array(COUNT);
    for(let i=0;i<COUNT;i++){
      positions[i*3+0] = 9999; // start off-canvas
      positions[i*3+1] = 9999;
      positions[i*3+2] = 0;
      sizes[i] = Math.random()*18+10;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes,1));
    const mat = new THREE.PointsMaterial({ map: tex, color: 0x889099, transparent:true, opacity:0.85, depthWrite:false, size: 16, sizeAttenuation:true });
    const points = new THREE.Points(geom, mat);
    group.add(points);

    return {
      group,
      emit(x,y){
        // shift a few particles to the emitter spot
        const p = geom.attributes.position.array;
        for(let k=0;k<12;k++){
          const i = Math.floor(Math.random()*COUNT);
          p[i*3+0] = x + (Math.random()-0.5)*12;
          p[i*3+1] = y + (Math.random()-0.5)*10;
          p[i*3+2] = 0;
        }
        geom.attributes.position.needsUpdate = true;
      },
      fade(){
        const p = geom.attributes.position.array;
        for(let i=0;i<COUNT;i++){
          // drift outward + fade by lifting “z”
          p[i*3+0] += (Math.random()-0.5)*0.6;
          p[i*3+1] += (Math.random()-0.5)*0.4;
        }
        geom.attributes.position.needsUpdate = true;
        points.material.opacity *= 0.994;
      }
    };
  }

  function onResize(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (mesh && mesh.material.uniforms) {
      mesh.material.uniforms.u_aspect.value = window.innerWidth/window.innerHeight;
    }
  }

  function animate(){
    requestAnimationFrame(animate);
    if (mesh) mesh.material.uniforms.u_time.value = (performance.now()/1000);
    if (smokeSys) smokeSys.fade();
    renderer.render(scene, camera);
  }

  // Takeoff animation → shrink into black hole → handoff
  function startJourney(){
    // figure out where the button is in canvas coords (center of screen)
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    // make smoke visible
    smokeSys.group.visible = true;

    const tl = gsap.timeline({
      defaults:{ ease: "power2.in", duration: 1.2 },
      onComplete(){
        // hide entry, boot solar system
        gsap.to(entry, { autoAlpha: 0, duration: 0.5, onComplete: () => {
          entry.style.display = 'none';
          if (window.initSolarSystem) window.initSolarSystem();
          if (window.startWelcomeSequence) window.startWelcomeSequence(); // overview → focus first planet
        }});
      }
    });

    // spiral path into the hole (center screen), scale down
    tl.to('#alien-start', {
      motionPath: {
        path: [
          { x:  0, y:  0 },
          { x: -40, y: -20 },
          { x:  60, y:  30 },
          { x:  0, y:   0 }
        ],
        curviness: 2
      },
      rotate: 360,
      duration: 0.9,
      ease: "power2.inOut",
      onUpdate(){
        const b = startBtn.getBoundingClientRect();
        const x = b.left + b.width/2;
        const y = b.top + b.height/2;
        smokeSys.emit(x, y);
      }
    })
    .to('#alien-start', {
      scale: 0.06,
      duration: 0.9,
      ease: "power3.in",
      onUpdate(){
        const b = startBtn.getBoundingClientRect();
        const x = b.left + b.width/2;
        const y = b.top + b.height/2;
        smokeSys.emit(x, y);
        if (mesh) mesh.material.uniforms.u_intensity.value = 1.2; // brighten a touch
      }
    }, "-=0.4");
  }

  // INIT
  initWormhole();

  // Button triggers the takeoff
  startBtn.addEventListener('click', startJourney);
})();
