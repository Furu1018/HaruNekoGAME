/*
  shared/neko.js
  こどもが かいた 3びきの ねこ を three.js (r128) で つくる ライブラリ。

  つかいかた:
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="../shared/neko.js"></script>

    const stage = NEKO.createStage(document.getElementById('stage'));
    const neko  = NEKO.create({ color: NEKO.COLORS.orange, eyes: 'open' });
    stage.scene.add(neko);
    stage.start((dt, t) => { NEKO.idle(neko, t); });

  ねこ の しくみ (かみに マーカーで かいた え を そのまま 3D に):
    - よこながの しかくい からだ
    - みぎはしに しかくい あたま (うえが はんえん)
    - あたまの うえに さんかくの みみ 2つ
    - ひだりはしに まるい しっぽ
    - からだの したに くろくて みじかい あし 4ほん
    - かお は こちらむき。くろい てんの め 2つ、ちいさい はな、「ω」の くち
    - ふとい くろせん の ふちどり
*/
(function (global) {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.error('neko.js: three.js を さきに よみこんで ください');
    return;
  }

  // ---- いろ -----------------------------------------------------------
  var COLORS = { orange: 0xf39a2b, blue: 0x2f88d8, yellow: 0xe6c21c };
  var PAPER = 0xfbf6e9;   // がようし の いろ
  var INK = 0x1c1a17;     // マーカー の くろ
  var LINE = 0.16;        // ふちどり の ふとさ

  // ---- 3びき の ねこ ----------------------------------------------------
  var CATS = [
    { id: 'orange', name: 'オレンジ', color: COLORS.orange, css: '#f39a2b', eyes: 'open' },
    { id: 'blue',   name: 'あお',     color: COLORS.blue,   css: '#2f88d8', eyes: 'open' },
    { id: 'yellow', name: 'きいろ',   color: COLORS.yellow, css: '#e6c21c', eyes: 'closed' }
  ];

  // ---- ざいりょう -------------------------------------------------------
  var inkMaterial = new THREE.MeshBasicMaterial({ color: INK });
  var hullMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  var textureCache = {};

  // マーカーで ぬった ような テクスチャ (canvas で つくる)
  function markerTexture(color) {
    var key = String(color);
    if (textureCache[key]) return textureCache[key];
    var size = 256;
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.fillRect(0, 0, size, size);

    var seed = 12345;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

    ctx.lineCap = 'round';
    for (var i = 0; i < 60; i++) {
      var x = rnd() * size, y = rnd() * size;
      var len = 60 + rnd() * 140;
      var ang = -0.75 + (rnd() - 0.5) * 0.5;
      var dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
      ctx.strokeStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 4 + rnd() * 8;
      // はしが つながる ように 9かい かく
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          ctx.beginPath();
          ctx.moveTo(x + ox * size, y + oy * size);
          ctx.lineTo(x + ox * size + dx, y + oy * size + dy);
          ctx.stroke();
        }
      }
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(0.3, 0.3);
    textureCache[key] = tex;
    return tex;
  }

  function skinMaterial(color) {
    return new THREE.MeshToonMaterial({ color: 0xffffff, map: markerTexture(color) });
  }

  // ---- かたち の ヘルパー -----------------------------------------------
  function shapeFromPoints(pts) {
    var s = new THREE.Shape();
    pts.forEach(function (p, i) { if (i === 0) s.moveTo(p[0], p[1]); else s.lineTo(p[0], p[1]); });
    s.closePath();
    return s;
  }

  function normalize(v) {
    var l = Math.hypot(v[0], v[1]) || 1;
    return [v[0] / l, v[1] / l];
  }

  // とつ たかっけい (はんとけいまわり) を t だけ そとに ひろげる
  function offsetPolygon(pts, t) {
    var n = pts.length, out = [];
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var n1 = normalize([p1[1] - p0[1], -(p1[0] - p0[0])]);
      var n2 = normalize([p2[1] - p1[1], -(p2[0] - p1[0])]);
      var bis = normalize([n1[0] + n2[0], n1[1] + n2[1]]);
      var cosHalf = bis[0] * n1[0] + bis[1] * n1[1];
      var d = t / Math.max(cosHalf, 0.4);
      out.push([p1[0] + bis[0] * d, p1[1] + bis[1] * d]);
    }
    return out;
  }

  function extrude(shape, depth) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, curveSegments: 28 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  // 2てん を むすぶ ふとい くろせん
  function edge(a, b) {
    var from = new THREE.Vector3(a[0], a[1], a[2]);
    var to = new THREE.Vector3(b[0], b[1], b[2]);
    var dir = to.clone().sub(from);
    var len = dir.length();
    var m = new THREE.Mesh(new THREE.BoxGeometry(len + LINE, LINE, LINE), inkMaterial);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    return m;
  }

  // たかっけい を おしだした かたまり + まわりの くろせん
  function prism(pts, depth, color) {
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(extrude(shapeFromPoints(pts), depth), skinMaterial(color)));
    var hz = depth / 2, n = pts.length;
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      grp.add(edge([p[0], p[1], hz], [q[0], q[1], hz]));      // まえ
      grp.add(edge([p[0], p[1], -hz], [q[0], q[1], -hz]));    // うしろ
      grp.add(edge([p[0], p[1], -hz], [p[0], p[1], hz]));     // おく ゆき
    }
    return grp;
  }

  function dot(r, x, y, z, flat) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), inkMaterial);
    m.position.set(x, y, z);
    if (flat) m.scale.z = 0.45;
    return m;
  }

  // ---- ぶひん -----------------------------------------------------------
  var BODY_W = 6.0, BODY_H = 3.0, BODY_D = 2.4;
  var HEAD_W = 3.4, HEAD_H = 1.7, HEAD_D = BODY_D;   // HEAD_H は しかくの ぶぶん の たかさ
  var HEAD_R = HEAD_W / 2;

  function makeBody(color) {
    var w = BODY_W / 2, h = BODY_H / 2;
    return prism([[-w, -h], [w, -h], [w, h], [-w, h]], BODY_D, color);
  }

  function makeHead(color) {
    var grp = new THREE.Group();
    var w = HEAD_R, h = HEAD_H, d = HEAD_D, t = LINE;

    // いろ の ついた あたま ("D" を よこに した かたち)
    var shape = new THREE.Shape();
    shape.moveTo(-w, 0);
    shape.lineTo(w, 0);
    shape.lineTo(w, h);
    shape.absarc(0, h, w, 0, Math.PI, false);
    shape.lineTo(-w, 0);
    grp.add(new THREE.Mesh(extrude(shape, d), skinMaterial(color)));

    // ふちどり (ひとまわり おおきい くろ を うらがわ だけ かく)
    var hull = new THREE.Shape();
    hull.moveTo(-w - t, -t);
    hull.lineTo(w + t, -t);
    hull.lineTo(w + t, h);
    hull.absarc(0, h, w + t, 0, Math.PI, false);
    hull.lineTo(-w - t, -t);
    grp.add(new THREE.Mesh(extrude(hull, d + t * 2), hullMaterial));

    // せん: たての ふち と はんえん の ふち
    var hz = d / 2;
    [hz, -hz].forEach(function (z) {
      grp.add(edge([-w, 0, z], [-w, h, z]));
      grp.add(edge([w, 0, z], [w, h, z]));
      var arc = new THREE.Mesh(new THREE.TorusGeometry(w, LINE / 2, 8, 40, Math.PI), inkMaterial);
      arc.position.set(0, h, z);
      grp.add(arc);
    });
    grp.add(edge([-w, 0, -hz], [-w, 0, hz]));
    grp.add(edge([w, 0, -hz], [w, 0, hz]));
    return grp;
  }

  function makeEar(color, side) {
    // side: -1 ひだり, +1 みぎ。あたま の うえに めりこませて おく
    var s = side;
    var pts = [[s * 0.35, 2.0], [s * 1.75, 2.0], [s * 1.55, 4.5]];
    if (s > 0) pts.reverse(); // はんとけいまわり に そろえる
    return prism(pts, 1.5, color);
  }

  function makeTail(color) {
    var grp = new THREE.Group();
    var r = 1.0, d = 1.5;
    var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 32), skinMaterial(color));
    body.rotation.x = Math.PI / 2;
    grp.add(body);
    var hull = new THREE.Mesh(new THREE.CylinderGeometry(r + LINE, r + LINE, d + LINE * 2, 32), hullMaterial);
    hull.rotation.x = Math.PI / 2;
    grp.add(hull);
    [d / 2, -d / 2].forEach(function (z) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(r, LINE / 2, 8, 40), inkMaterial);
      ring.position.z = z;
      grp.add(ring);
    });
    return grp;
  }

  function makeLeg() {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.85), inkMaterial);
    return m;
  }

  function makeOpenEyes(z) {
    var grp = new THREE.Group();
    grp.add(dot(0.3, -0.8, 2.15, z, true));
    grp.add(dot(0.3, 0.8, 2.15, z, true));
    return grp;
  }

  function makeClosedEyes(z) {
    // 「><」 の め。にっこり。
    var grp = new THREE.Group();
    var y = 2.15, len = 0.55, spread = 0.28;
    [-1, 1].forEach(function (s) {
      var tipX = s * 0.45;              // とがった ほう が まんなか を むく
      var backX = s * (0.45 + len);
      grp.add(edge([backX, y + spread, z], [tipX, y, z]));
      grp.add(edge([backX, y - spread, z], [tipX, y, z]));
    });
    return grp;
  }

  function makeMouth(z) {
    // 「ω」 の くち と ちいさい はな
    var grp = new THREE.Group();
    [-0.36, 0.36].forEach(function (x) {
      var arc = new THREE.Mesh(new THREE.TorusGeometry(0.36, LINE / 2, 8, 24, Math.PI), inkMaterial);
      arc.position.set(x, 1.25, z);
      arc.rotation.z = Math.PI; // したむき の はんえん 「∪」
      grp.add(arc);
    });
    grp.add(dot(0.13, 0, 1.4, z, false));
    return grp;
  }

  // ---- ねこ を つくる -----------------------------------------------------
  // opts: { color: 0xf39a2b, eyes: 'open' | 'closed', name: 'オレンジ', id: 'orange' }
  function create(opts) {
    opts = opts || {};
    var color = opts.color != null ? opts.color : COLORS.orange;
    var eyes = opts.eyes || 'open';

    var neko = new THREE.Group();
    neko.userData.isNeko = true;
    neko.userData.id = opts.id || null;
    neko.userData.name = opts.name || '';
    neko.userData.color = color;

    var parts = {};

    // からだ (まんなか が げんてん、ゆか は y = -BODY_H/2 - あし)
    var body = makeBody(color);
    neko.add(body);
    parts.body = body;

    // あたま: からだ の みぎはし の うえ
    var head = new THREE.Group();
    head.position.set(BODY_W / 2 - HEAD_R, BODY_H / 2, 0);
    head.add(makeHead(color));
    parts.head = head;

    // みみ
    var earL = makeEar(color, -1), earR = makeEar(color, 1);
    head.add(earL, earR);
    parts.ears = [earL, earR];

    // かお
    var faceZ = HEAD_D / 2 + 0.02;
    var open = makeOpenEyes(faceZ), closed = makeClosedEyes(faceZ);
    open.visible = eyes !== 'closed';
    closed.visible = eyes === 'closed';
    head.add(open, closed, makeMouth(faceZ));
    parts.eyesOpen = open;
    parts.eyesClosed = closed;
    neko.add(head);

    // しっぽ: からだ の ひだりはし、すこし した
    var tail = new THREE.Group();
    tail.position.set(-BODY_W / 2, -0.2, 0);
    var tailBody = makeTail(color);
    tailBody.position.x = -0.55; // はし から すこし はみだす
    tail.add(tailBody);
    neko.add(tail);
    parts.tail = tail;

    // あし 4ほん
    parts.legs = [];
    [-2.1, -0.7, 0.7, 2.1].forEach(function (x) {
      var leg = makeLeg();
      leg.position.set(x, -BODY_H / 2 - 0.3, 0);
      neko.add(leg);
      parts.legs.push(leg);
    });

    neko.userData.parts = parts;
    neko.userData.eyes = eyes;
    neko.userData.baseY = 0;
    return neko;
  }

  function createById(id) {
    var cat = CATS.filter(function (c) { return c.id === id; })[0] || CATS[0];
    return create(cat);
  }

  function createAll() {
    return CATS.map(function (c) { return create(c); });
  }

  function setEyes(neko, eyes) {
    var p = neko.userData.parts;
    if (!p) return;
    p.eyesOpen.visible = eyes !== 'closed';
    p.eyesClosed.visible = eyes === 'closed';
    neko.userData.eyes = eyes;
  }

  // じっと している ときの うごき (しっぽ ふりふり、ちょっと ゆれる)
  function idle(neko, t, phase) {
    var p = neko.userData.parts;
    if (!p) return;
    var ph = phase || 0;
    p.tail.rotation.z = Math.sin(t * 3 + ph) * 0.35;
    p.head.rotation.z = Math.sin(t * 1.3 + ph) * 0.04;
    p.ears[0].rotation.z = Math.sin(t * 2.1 + ph) * 0.05;
    p.ears[1].rotation.z = -Math.sin(t * 2.1 + ph + 1) * 0.05;
    neko.position.y = neko.userData.baseY + Math.sin(t * 2 + ph) * 0.08;
  }

  // ねこ の たかさ (ゆか から あたま の てっぺん まで) と はば
  var SIZE = {
    width: BODY_W + 1.6,
    height: BODY_H / 2 + HEAD_H + HEAD_R + 1.3, // げんてん から みみ の さき まで
    floorY: -BODY_H / 2 - 0.75                  // げんてん から あし の した まで
  };

  // カメラ を さげて、はば width・たかさ height (せかい の たんい) が がめん に おさまる ように する
  // centerY: まんなか に したい たかさ。margin: よゆう (1.15 なら 15% ひろめ)
  function fitCamera(camera, aspect, width, height, centerY, margin) {
    var m = margin || 1.15;
    var tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    var distW = (width * m / 2) / (tanHalf * Math.max(aspect, 0.01));
    var distH = (height * m / 2) / tanHalf;
    var dist = Math.max(distW, distH);
    var cy = centerY || 0;
    camera.position.set(0, cy + dist * 0.12, dist);
    camera.lookAt(0, cy, 0);
    return dist;
  }

  // ---- ぶたい (scene / camera / renderer) ----------------------------------
  // container: <div> など。なか に canvas を いれて、おおきさ に あわせる。
  // opts: { background, alpha, fov, onResize: function (w, h, stage) {} }
  function createStage(container, opts) {
    opts = opts || {};
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.alpha });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (!opts.alpha) renderer.setClearColor(opts.background != null ? opts.background : PAPER, 1);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(opts.fov || 32, 1, 0.1, 300);
    camera.position.set(0, 3, 26);
    camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcdbf9a, 0.55));
    var sun = new THREE.DirectionalLight(0xffffff, 0.5);
    sun.position.set(5, 9, 12);
    scene.add(sun);

    var api; // した で つくる
    function resize() {
      var w = container.clientWidth || 1, h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (opts.onResize) opts.onResize(w, h, api);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 100); });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container);

    var running = false, raf = 0, last = 0, tick = null;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var t = now / 1000;
      var dt = Math.min(0.05, Math.max(0, t - last));
      last = t;
      if (tick) tick(dt, t);
      renderer.render(scene, camera);
    }

    api = {
      scene: scene, camera: camera, renderer: renderer, resize: resize,
      start: function (fn) {
        if (fn) tick = fn;
        if (running) return;
        running = true;
        last = performance.now() / 1000;
        raf = requestAnimationFrame(frame);
      },
      stop: function () { running = false; cancelAnimationFrame(raf); },
      // canvas の うえ の (x, y) に ある ねこ を かえす
      pick: function (clientX, clientY, nekos) {
        var rect = renderer.domElement.getBoundingClientRect();
        var v = new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );
        var ray = new THREE.Raycaster();
        ray.setFromCamera(v, camera);
        var hits = ray.intersectObjects(nekos, true);
        if (!hits.length) return null;
        var o = hits[0].object;
        while (o && !o.userData.isNeko) o = o.parent;
        return o || null;
      }
    };
    resize();
    return api;
  }

  global.NEKO = {
    COLORS: COLORS,
    PAPER: PAPER,
    INK: INK,
    LINE: LINE,
    CATS: CATS,
    SIZE: SIZE,
    create: create,
    createById: createById,
    createAll: createAll,
    setEyes: setEyes,
    idle: idle,
    fitCamera: fitCamera,
    createStage: createStage
  };
})(window);
