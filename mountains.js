/*
  Research page background: climbing at night.
  - Scrolling = climbing. The near ridges sink away and farther, taller ridges
    rise up behind them: 一山放出一山拦.
  - Each project card lights a star in the sky as it comes into view; lit stars
    join into a constellation. At the bottom of the page, a star appears over the summit.
*/
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var ridgesSvg = document.querySelector('.night .ridges');
  var skySvg = document.querySelector('.night .sky-stars');
  if (!ridgesSvg || !skySvg) return;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Seeded randomness (same scene on every visit) ---------- */
  var seed = 7101;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function between(a, b) { return a + (b - a) * rand(); }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  /* ---------- Sky stars ---------- */
  var skyGroup = el('g', {}, skySvg);
  for (var i = 0; i < 170; i++) {
    var c = el('circle', {
      cx: between(0, 1600).toFixed(1),
      cy: (Math.pow(rand(), 1.4) * 760).toFixed(1),   // denser near the top of the sky
      r: between(0.5, 1.7).toFixed(2),
      opacity: between(0.3, 0.95).toFixed(2)
    }, skyGroup);
    if (rand() < 0.3) {
      c.setAttribute('class', 'twinkle');
      c.style.animationDelay = between(0, 4).toFixed(2) + 's';
      c.style.animationDuration = between(3, 6).toFixed(2) + 's';
    }
  }

  /* ---------- Mountain ridges ----------
     Index 0 is the nearest ridge, 5 the farthest (and tallest: the summit).
     from/to: how far each ridge is shifted down at the top / bottom of the page. */
  var RIDGES = [
    { top: 790, amp: 40, peak: 70,  color: '#070a14', from: 0,   to: 820 },
    { top: 710, amp: 45, peak: 90,  color: '#0c1222', from: 0,   to: 660 },
    { top: 630, amp: 50, peak: 110, color: '#141b33', from: 0,   to: 500 },
    { top: 560, amp: 50, peak: 130, color: '#1e2745', from: 270, to: 460 },
    { top: 490, amp: 55, peak: 160, color: '#2b3456', from: 400, to: 340 },
    { top: 430, amp: 50, peak: 270, color: '#3b4368', from: 560, to: 240, summit: true }
  ];

  var layers = [];
  for (var k = RIDGES.length - 1; k >= 0; k--) {   // draw far ridges first
    var R = RIDGES[k];
    var f1 = Math.PI * 2 / between(520, 900), f2 = Math.PI * 2 / between(170, 300), f3 = Math.PI * 2 / between(55, 110);
    var p1 = between(0, 6.28), p2 = between(0, 6.28), p3 = between(0, 6.28);
    var px = R.summit ? between(700, 900) : between(150, 1450);
    var pw = R.summit ? 230 : between(140, 260);
    var pts = [], peakY = 9999;
    for (var x = -60; x <= 1660; x += 10) {
      var n = 0.55 * Math.sin(x * f1 + p1) + 0.3 * Math.sin(x * f2 + p2) + 0.15 * Math.sin(x * f3 + p3);
      var y = R.top + R.amp * n - R.peak * Math.exp(-Math.abs(x - px) / pw) + between(-2.5, 2.5);
      pts.push(x + ' ' + y.toFixed(1));
      if (Math.abs(x - px) < 6) peakY = y;
    }
    var g = el('g', {}, ridgesSvg);
    el('path', { d: 'M-60 2400L' + pts.join('L') + 'L1660 2400Z', fill: R.color }, g);
    // a faint moonlit rim along the ridge line
    el('path', { d: 'M' + pts.join('L'), fill: 'none', stroke: 'rgba(200,210,255,0.08)', 'stroke-width': 1.5 }, g);

    var summitStar = null;
    if (R.summit) {
      summitStar = el('g', { opacity: 0 }, g);
      var defs = el('defs', {}, ridgesSvg);
      var grad = el('radialGradient', { id: 'summit-glow' }, defs);
      el('stop', { offset: '0%', 'stop-color': '#f6dc8f', 'stop-opacity': 0.55 }, grad);
      el('stop', { offset: '100%', 'stop-color': '#f6dc8f', 'stop-opacity': 0 }, grad);
      el('circle', { cx: px, cy: peakY - 70, r: 46, fill: 'url(#summit-glow)' }, summitStar);
      el('path', {
        d: 'M' + px + ' ' + (peakY - 92) + 'L' + (px + 5) + ' ' + (peakY - 75) + 'L' + (px + 22) + ' ' + (peakY - 70) +
           'L' + (px + 5) + ' ' + (peakY - 65) + 'L' + px + ' ' + (peakY - 48) + 'L' + (px - 5) + ' ' + (peakY - 65) +
           'L' + (px - 22) + ' ' + (peakY - 70) + 'L' + (px - 5) + ' ' + (peakY - 75) + 'Z',
        fill: '#f6dc8f'
      }, summitStar);
    }
    layers.push({ g: g, from: R.from, to: R.to, summit: summitStar });
  }

  /* ---------- Project stars + constellation ---------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll('.project'));
  var starBox = document.querySelector('.night .project-stars');
  var lines = document.querySelector('.night .constellation');
  var stars = cards.map(function (card, i) {
    var left = i % 2 === 0;
    var x = left ? between(6, 20) : between(80, 94);
    var y = 58 - (cards.length > 1 ? (i / (cards.length - 1)) * 44 : 18) + between(-3, 3);
    var s = document.createElement('span');
    s.className = 'p-star';
    s.style.left = x + '%';
    s.style.top = y + '%';
    starBox.appendChild(s);
    return { el: s, card: card, x: x, y: y, lit: false };
  });

  function join(a, b) {
    var l = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, opacity: 0 }, lines);
    requestAnimationFrame(function () { l.setAttribute('opacity', 1); });
  }
  function light(i) {
    var s = stars[i];
    if (s.lit) return;
    s.lit = true;
    s.el.classList.add('lit');
    s.card.classList.add('lit');
    if (i > 0 && stars[i - 1].lit) join(stars[i - 1], s);
    if (i < stars.length - 1 && stars[i + 1].lit) join(s, stars[i + 1]);
  }

  /* ---------- Climb with the scroll ---------- */
  function place(p) {
    for (var j = 0; j < layers.length; j++) {
      var L = layers[j];
      L.g.setAttribute('transform', 'translate(0 ' + (L.from + (L.to - L.from) * p).toFixed(1) + ')');
      if (L.summit) L.summit.setAttribute('opacity', smooth(0.82, 1, p).toFixed(3));
    }
    skyGroup.setAttribute('opacity', (0.55 + 0.45 * p).toFixed(3));   // more stars the higher you climb
  }

  if (reduceMotion) {
    place(0.4);
    stars.forEach(function (s, i) { light(i); });
    return;
  }

  function progress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? clamp01(window.scrollY / max) : 1;
  }
  var shown = 0, frame = null;
  function tick() {
    var target = progress();
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.0005) shown = target;
    place(shown);
    frame = shown !== target ? requestAnimationFrame(tick) : null;
  }
  function wake() { if (!frame) frame = requestAnimationFrame(tick); }
  place(0);
  wake();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) light(cards.indexOf(e.target));
      });
    }, { threshold: 0.6 });
    cards.forEach(function (c) { io.observe(c); });
  } else {
    stars.forEach(function (s, i) { light(i); });
  }
})();
