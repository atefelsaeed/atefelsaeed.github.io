/* Page behavior: mobile menu, hero (rotating words, phone slides, count-up), scroll reveal, scroll progress. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T = window.SITE || {};

  /* Mobile menu */
  var menuBtn = document.getElementById('menuBtn'), navLinks = document.getElementById('navLinks');
  menuBtn.addEventListener('click', function () {
    var open = navLinks.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  navLinks.addEventListener('click', function (e) { if (e.target.tagName === 'A') { navLinks.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });

  /* Rotating hero text */
  var words = T.words || ['fintech products'];
  var rot = document.getElementById('rotText');
  if (!reduce) {
    var wi = 0, ci = words[0].length, deleting = true;
    setTimeout(function tick() {
      var w = words[wi];
      if (deleting) { ci--; if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; } }
      else { ci++; if (ci >= words[wi].length) { deleting = true; rot.textContent = words[wi]; setTimeout(tick, 2000); return; } }
      rot.textContent = words[wi].slice(0, Math.max(ci, 0)) || '​';
      setTimeout(tick, deleting ? 35 : 70);
    }, 2200);
  }

  /* Phone slides */
  var slides = document.querySelectorAll('.slide'), dots = document.querySelectorAll('.dots button'), si = 0, timer;
  function go(i) {
    si = i;
    slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
  }
  function auto() { clearInterval(timer); if (!reduce) timer = setInterval(function () { go((si + 1) % slides.length); }, 4200); }
  dots.forEach(function (d) { d.addEventListener('click', function () { go(+d.getAttribute('data-go')); auto(); }); });
  auto();

  /* Count-up */
  function countUp(el) {
    var target = +el.getAttribute('data-count'), sep = el.hasAttribute('data-sep'), t0 = null;
    function fmt(v) { return sep ? v.toLocaleString('en-US') : String(v); }
    if (reduce) { el.textContent = fmt(target); return; }
    function step(ts) { if (!t0) t0 = ts; var p = Math.min((ts - t0) / 1400, 1); el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); }
    el.textContent = fmt(0); requestAnimationFrame(step);
  }
  document.querySelectorAll('[data-count]').forEach(countUp);

  /* Reveal on scroll: only items below the first screen get an entrance; everything shows within 3s regardless. */
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var bars = document.querySelectorAll('.grow');
  function showBars() { bars.forEach(function (b) { b.style.width = b.style.getPropertyValue('--w'); }); }
  if (!reduce && 'IntersectionObserver' in window) {
    var vh = window.innerHeight;
    items.forEach(function (el) { if (el.getBoundingClientRect().top > vh) el.classList.add('pending'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target, delay = (el.parentElement && Array.prototype.indexOf.call(el.parentElement.children, el) % 3) * 80;
          setTimeout(function () { el.classList.add('shown'); el.classList.remove('pending'); }, delay);
          if (el.querySelector('.grow')) setTimeout(showBars, 200);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
    setTimeout(function () { items.forEach(function (el) { el.classList.remove('pending'); }); showBars(); }, 3000);
  } else { showBars(); }

  /* Spotlight on service cards */
  document.querySelectorAll('.svc').forEach(function (c) {
    c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });

  /* Scroll progress, back to top, active nav link */
  var prog = document.getElementById('progress'), toTop = document.getElementById('toTop');
  var navAs = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var secs = navAs.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = 'scaleX(' + (h > 0 ? window.scrollY / h : 0) + ')';
    toTop.classList.toggle('on', window.scrollY > 600);
    var cur = 0;
    secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < 120) cur = i; });
    navAs.forEach(function (a, i) { a.classList.toggle('active', i === cur); });
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
})();
