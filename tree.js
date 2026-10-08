/*
  Library tree: draws a tree in the page background and grows it upward
  as the reader scrolls (trunk first, then branches, then leaves).
  The shape is generated from a fixed seed, so it is the same on every visit.
*/
(function () {
  var svg = document.querySelector('.tree-bg svg');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Settings you can tweak ---------- */
  var SEED = 20261007;          // change this number for a different tree shape
  var BARK = ['#4d4034', '#57493b', '#63543f', '#6f6048', '#7a6c52'];
  var LEAVES = ['#5f8a52', '#6f9a5c', '#7ea566', '#8fb277', '#a6c38c', '#bccf98'];
  var START = 0.5;              // how grown the tree is at the top of a long page
  var INTRO_MS = 2200;          // length of the first growth when the page opens

  /* ---------- Seeded randomness ---------- */
  var seed = SEED;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function between(a, b) { return a + (b - a) * rand(); }
  function pick(list) { return list[Math.floor(rand() * list.length)]; }
  function r1(n) { return Math.round(n * 10) / 10; }
  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  /* ---------- Build the tree as data ----------
     Angles are in radians, 0 = straight up. Times are in "growth units":
     a branch takes as long to grow as it is long. */
  var SPEED = 260;
  var TRUNK_SPEED = SPEED * 1.8; // the trunk shoots up faster than the branches spread
  var branches = [];
  var leaves = [];

  // A branch is drawn as a few short pieces that get thinner along its length,
  // so it tapers smoothly instead of stepping down in width at each joint.
  function segment(x, y, cx, cy, x2, y2, w0, w1, depth, t0, dur) {
    var n = depth === 0 ? 6 : depth === 1 ? 4 : depth === 2 ? 2 : 1;
    function at(a) {
      var u = 1 - a;
      return [u * u * x + 2 * a * u * cx + a * a * x2, u * u * y + 2 * a * u * cy + a * a * y2];
    }
    for (var k = 0; k < n; k++) {
      var a = k / n, b = (k + 1) / n;
      var p0 = at(a), p2 = at(b);
      var m = (1 - a) * b + a * (1 - b);
      var qx = (1 - a) * (1 - b) * x + m * cx + a * b * x2;
      var qy = (1 - a) * (1 - b) * y + m * cy + a * b * y2;
      branches.push({
        d: 'M' + r1(p0[0]) + ' ' + r1(p0[1]) + 'Q' + r1(qx) + ' ' + r1(qy) + ' ' + r1(p2[0]) + ' ' + r1(p2[1]),
        width: Math.max(w0 + (w1 - w0) * ((k + 0.5) / n), 1.1),
        depth: depth,
        t0: t0 + a * dur,
        t1: t0 + b * dur
      });
    }
  }

  function addLeaves(x, y, angle, t, count, spread) {
    for (var i = 0; i < count; i++) {
      var a = angle + between(-1.7, 1.7);
      var r = between(0, spread);
      leaves.push({
        x: x + Math.sin(a) * r,
        y: y - Math.cos(a) * r,
        deg: (a * 180 / Math.PI) - 90 + between(-25, 25),
        size: between(8, 14),
        color: pick(LEAVES),
        alpha: between(0.72, 0.95),
        t0: t + between(0, 0.15),
        dur: between(0.2, 0.35)
      });
    }
  }

  function branch(x, y, angle, len, width, depth, t) {
    var x2 = x + Math.sin(angle) * len;
    var y2 = y - Math.cos(angle) * len;
    var bend = between(-0.16, 0.16) * len;
    var cx = (x + x2) / 2 + Math.cos(angle) * bend;
    var cy = (y + y2) / 2 + Math.sin(angle) * bend;
    var dur = len / SPEED;
    var tip = depth >= 4 || len < 18;
    segment(x, y, cx, cy, x2, y2, width, width * (tip ? 0.5 : 0.68), depth, t, dur);

    var end = t + dur;
    if (tip) {
      addLeaves(x2, y2, angle, end, Math.round(between(4, 7)), 16);
      return;
    }
    // a few leaves along the way, so even a young tree is green
    addLeaves(cx, cy, angle, t + dur * 0.55, Math.round(between(depth === 1 ? 2 : 1, 3)), 9);

    var kids = depth < 2 ? 2 : (rand() < 0.55 ? 2 : 3);
    for (var i = 0; i < kids; i++) {
      var side = kids === 2 ? (i === 0 ? -1 : 1) : (i - 1);
      var a = angle + side * between(0.32, 0.6) + between(-0.1, 0.1);
      a *= 0.88; // lean toward the light: branches keep reaching upward
      branch(x2, y2, a, len * between(0.62, 0.8), width * 0.68, depth + 1, end);
    }
  }

  function trunk() {
    var x = 300, y = 992, angle = between(-0.03, 0.03), len = 128, width = 22, t = 0;
    var side = rand() < 0.5 ? -1 : 1;
    for (var i = 0; i < 9; i++) {
      var x2 = x + Math.sin(angle) * len;
      var y2 = y - Math.cos(angle) * len;
      var dur = len / TRUNK_SPEED;
      segment(x, y, (x + x2) / 2 + between(-6, 6), (y + y2) / 2, x2, y2, width, width * 0.84, 0, t, dur);
      t += dur;
      if (i >= 1) {
        // one side branch per joint, alternating sides; the lowest and highest are shorter
        var reach = i === 1 ? 0.7 : i < 7 ? 1.05 : 0.8;
        branch(x2, y2, side * between(0.6, 0.98), len * between(0.85, 1.1) * reach, width * 0.62, 1, t);
        addLeaves(x2, y2, angle, t, 2, 12);
        side = -side;
      }
      x = x2; y = y2;
      angle = angle * 0.5 + between(-0.06, 0.06);
      len *= 0.9;
      width *= 0.84;
    }
    // the leader splits into a crown at the top
    branch(x, y, angle - between(0.15, 0.35), len, width * 0.8, 1, t);
    branch(x, y, angle + between(0.15, 0.35), len, width * 0.8, 1, t);
  }

  trunk();

  var total = 0;
  branches.forEach(function (b) { total = Math.max(total, b.t1); });
  leaves.forEach(function (l) { total = Math.max(total, l.t0 + l.dur); });

  /* ---------- Draw it ---------- */
  var ground = document.createElementNS(NS, 'path');
  ground.setAttribute('d', 'M70 994 Q300 978 530 994');
  ground.setAttribute('fill', 'none');
  ground.setAttribute('stroke', '#b8c4a0');
  ground.setAttribute('stroke-width', '2');
  ground.setAttribute('stroke-linecap', 'round');
  svg.appendChild(ground);

  var wood = document.createElementNS(NS, 'g');
  wood.setAttribute('fill', 'none');
  wood.setAttribute('stroke-linecap', 'round');
  svg.appendChild(wood);

  var foliage = document.createElementNS(NS, 'g');
  svg.appendChild(foliage);

  branches.forEach(function (b) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('d', b.d);
    el.setAttribute('stroke', BARK[Math.min(b.depth, BARK.length - 1)]);
    el.setAttribute('stroke-width', r1(b.width));
    wood.appendChild(el);
    b.el = el;
    b.len = el.getTotalLength();
    el.style.strokeDasharray = b.len + ' ' + b.len;
    b.last = -1;
  });

  var LEAF = 'M0 0C3 -3.4 7 -3.8 10 0C7 3.8 3 3.4 0 0Z'; // a leaf 10 units long, stem at 0,0
  leaves.forEach(function (l) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('d', LEAF);
    el.setAttribute('fill', l.color);
    el.setAttribute('fill-opacity', r1(l.alpha * 100) / 100);
    foliage.appendChild(el);
    l.el = el;
    l.base = 'translate(' + r1(l.x) + ' ' + r1(l.y) + ') rotate(' + Math.round(l.deg) + ') scale(';
    l.k = l.size / 10;
    l.last = -1;
  });

  /* ---------- Grow to a given progress (0 = seed, 1 = full tree) ---------- */
  function render(p) {
    var time = p * total;
    var i, b, l, local;
    for (i = 0; i < branches.length; i++) {
      b = branches[i];
      local = clamp01((time - b.t0) / (b.t1 - b.t0));
      if (local === b.last) continue;
      b.last = local;
      b.el.style.visibility = local > 0 ? 'visible' : 'hidden';
      b.el.style.strokeDashoffset = b.len * (1 - local);
    }
    for (i = 0; i < leaves.length; i++) {
      l = leaves[i];
      local = clamp01((time - l.t0) / l.dur);
      if (local === l.last) continue;
      l.last = local;
      l.el.style.visibility = local > 0 ? 'visible' : 'hidden';
      var eased = 1 - Math.pow(1 - local, 3);
      l.el.setAttribute('transform', l.base + (l.k * eased).toFixed(3) + ')');
    }
  }

  if (reduceMotion) { render(1); return; }

  /* ---------- Tie growth to scrolling ---------- */
  function scrollFraction() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max < window.innerHeight * 0.5) return 1; // short page: just grow the whole tree
    return clamp01(window.scrollY / max);
  }

  var shown = 0, reached = 0, introStart = null, frame = null;

  function tick(now) {
    if (introStart === null) introStart = now;
    var intro = clamp01((now - introStart) / INTRO_MS);
    var easedIntro = 1 - Math.pow(1 - intro, 3);
    var goal = easedIntro * (START + (1 - START) * scrollFraction());
    reached = Math.max(reached, goal);           // a tree never shrinks back
    shown += (reached - shown) * 0.09;
    if (Math.abs(reached - shown) < 0.0005) shown = reached;
    render(shown);
    frame = (intro < 1 || shown !== reached) ? requestAnimationFrame(tick) : null;
  }
  function wake() { if (!frame) frame = requestAnimationFrame(tick); }

  render(0);
  wake();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);
})();
