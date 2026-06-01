/* ============================================================
   Scene3D — an immersive flight through floating memories
   Vanilla Three.js (r128 UMD global THREE). No modules.
   Exposes window.Scene3D = { setScroll(p), setPointer(x,y), resize() }
   ============================================================ */
(function () {
  if (!window.THREE) { console.warn('THREE not loaded'); return; }

  const canvas = document.getElementById('webgl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const MIST = new THREE.Color('#e7c2ba');   // rose mist that things dissolve into
  scene.background = new THREE.Color('#f1d8d0');
  scene.fog = new THREE.FogExp2(MIST, 0.019);

  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 240);
  camera.position.set(0, 0, 6);

  /* ---------- texture loading (cached) ---------- */
  const loader = new THREE.TextureLoader();
  const cache = {};
  function getTex(src, onReady) {
    if (cache[src]) { if (onReady) onReady(cache[src]); return cache[src]; }
    const t = loader.load(src, (tx) => { if (onReady) onReady(tx); });
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
    t.minFilter = THREE.LinearFilter;
    cache[src] = t;
    return t;
  }

  const PHOTOS = [
    'photos/p05.jpeg','photos/p09.jpeg','photos/p04.jpeg','photos/p10.jpeg',
    'photos/p06.jpeg','photos/p02.jpeg','photos/p12.jpeg','photos/p07.jpeg',
    'photos/p13.jpeg','photos/p03.jpeg','photos/p14.jpeg','photos/p11.jpeg',
    'photos/p01.jpeg'
  ];

  const photoMeshes = []; // {group, phase, baseY, spin}

  /* a framed floating photo (cream mat + photo) */
  function makePhoto(src, opts) {
    const g = new THREE.Group();
    const height = opts.h || 4;

    const mat = new THREE.MeshBasicMaterial({ color: 0xfdf6f1, fog: true });
    const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    matMesh.position.z = -0.02;
    g.add(matMesh);

    const pMat = new THREE.MeshBasicMaterial({
      map: getTex(src, (tx) => {
        const img = tx.image;
        if (img && img.width) {
          const aspect = img.width / img.height;
          const w = height * aspect;
          photoMesh.scale.set(w, height, 1);
          const pad = height * 0.06;
          matMesh.scale.set(w + pad, height + pad, 1);
        }
      }),
      transparent: true,
      opacity: opts.opacity != null ? opts.opacity : 1,
      fog: true
    });
    const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pMat);
    photoMesh.scale.set(height * 0.72, height, 1); // provisional until image loads
    g.add(photoMesh);

    g.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
    g.rotation.z = (opts.rotZ || 0);
    g.rotation.y = (opts.rotY || 0);
    scene.add(g);
    photoMeshes.push({
      group: g, baseY: opts.y || 0,
      phase: Math.random() * Math.PI * 2,
      bob: 0.06 + Math.random() * 0.12,
      spin: (Math.random() - 0.5) * 0.04,
      drift: opts.ambient ? (Math.random() - 0.5) * 0.0006 : 0
    });
    return g;
  }

  /* ---------- feature photos: spaced along the flight path ---------- */
  const DEPTH = 96;
  const feat = [
    { h: 6.6, x: 0.0,  y: 0.2,  rotY: 0.0 },
    { h: 4.2, x: 2.7,  y: 0.9,  rotY: -0.22 },
    { h: 3.0, x: -3.1, y: -1.1, rotY: 0.26 },
    { h: 3.0, x: 3.0,  y: 1.3,  rotY: -0.24 },
    { h: 3.2, x: -2.5, y: 1.4,  rotY: 0.22 },
    { h: 3.2, x: 2.3,  y: -1.4, rotY: -0.2 },
    { h: 5.6, x: -1.3, y: 0.3,  rotY: 0.12 },
    { h: 6.6, x: 0.7,  y: 0.1,  rotY: -0.08 },
    { h: 3.0, x: -3.2, y: -0.7, rotY: 0.26 },
    { h: 4.6, x: 2.6,  y: 0.7,  rotY: -0.2 },
    { h: 4.6, x: -2.7, y: 0.9,  rotY: 0.2 },
    { h: 3.4, x: 2.9,  y: -1.0, rotY: -0.22 },
    { h: 6.0, x: -1.0, y: 0.2,  rotY: 0.1 }
  ];
  PHOTOS.forEach((src, i) => {
    const o = feat[i % feat.length];
    const z = -2 - i * ((DEPTH - 4) / PHOTOS.length);
    makePhoto(src, { x: o.x, y: o.y, z, h: o.h, rotY: o.rotY, rotZ: (Math.random() - 0.5) * 0.05 });
  });

  /* ---------- ambient smaller memories scattered in the volume ---------- */
  for (let i = 0; i < 16; i++) {
    const src = PHOTOS[(Math.random() * PHOTOS.length) | 0];
    makePhoto(src, {
      x: (Math.random() - 0.5) * 22,
      y: (Math.random() - 0.5) * 12,
      z: -3 - Math.random() * (DEPTH - 4),
      h: 1.3 + Math.random() * 1.6,
      rotY: (Math.random() - 0.5) * 0.6,
      rotZ: (Math.random() - 0.5) * 0.12,
      opacity: 0.55,
      ambient: true
    });
  }

  /* ---------- bokeh / floating light motes (additive) ---------- */
  function softSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,243,238,1)');
    grd.addColorStop(0.35, 'rgba(244,205,196,0.65)');
    grd.addColorStop(1, 'rgba(244,205,196,0)');
    x.fillStyle = grd; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill();
    return new THREE.CanvasTexture(c);
  }
  const moteCount = innerWidth < 640 ? 60 : 110;
  const mGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    mPos[i * 3] = (Math.random() - 0.5) * 26;
    mPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    mPos[i * 3 + 2] = 6 - Math.random() * (DEPTH + 6);
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  const mMat = new THREE.PointsMaterial({
    size: 0.9, map: softSprite(), transparent: true, opacity: 0.6,
    depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe6dc,
    sizeAttenuation: true, fog: false
  });
  const motes = new THREE.Points(mGeo, mMat);
  scene.add(motes);

  /* ---------- interaction state ---------- */
  let scrollP = 0, targetP = 0;
  let ptrX = 0, ptrY = 0, tPtrX = 0, tPtrY = 0;
  const clock = new THREE.Clock();

  function frame() {
    const t = clock.getElapsedTime();
    scrollP += (targetP - scrollP) * 0.08;
    ptrX += (tPtrX - ptrX) * 0.05;
    ptrY += (tPtrY - ptrY) * 0.05;

    const p = scrollP;
    const sway = Math.sin(p * Math.PI * 3) * 1.5;
    const camZ = 6 - p * DEPTH;
    camera.position.x += ((sway + ptrX * 1.8) - camera.position.x) * 0.08;
    camera.position.y += ((ptrY * 1.1 + Math.sin(p * 7) * 0.25) - camera.position.y) * 0.08;
    camera.position.z += (camZ - camera.position.z) * 0.12;
    const aheadX = Math.sin((p + 0.05) * Math.PI * 3) * 1.5;
    camera.lookAt(aheadX + ptrX * 0.6, ptrY * 0.4, camera.position.z - 10);

    // bob + gentle sway of every memory
    for (const m of photoMeshes) {
      m.group.position.y = m.baseY + Math.sin(t * 0.5 + m.phase) * m.bob;
      m.group.rotation.z += 0; // keep set rotation
      m.group.rotation.z = Math.sin(t * 0.3 + m.phase) * 0.025 + (m.group.userData.baseRotZ || 0);
      if (m.drift) m.group.position.x += m.drift;
    }
    motes.rotation.y = Math.sin(t * 0.05) * 0.05;
    mMat.opacity = 0.45 + Math.sin(t * 0.8) * 0.12;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  // remember base z-rotations
  photoMeshes.forEach(m => { m.group.userData.baseRotZ = m.group.rotation.z; });
  requestAnimationFrame(frame);

  /* ---------- API ---------- */
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  window.addEventListener('resize', resize);

  window.Scene3D = {
    setScroll(p) { targetP = Math.max(0, Math.min(1, p)); },
    setPointer(x, y) { tPtrX = x; tPtrY = y; },
    resize,
    _debug() {
      return {
        photoMeshes: photoMeshes.length,
        sceneChildren: scene.children.length,
        texturesLoaded: Object.keys(cache).filter(k => cache[k].image && cache[k].image.width).length,
        camZ: camera.position.z.toFixed(2)
      };
    }
  };
})();
