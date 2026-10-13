(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Projects data */
  var T = window.SITE || {};
  var S = T.strings || {};
  var projects = T.projects || [];
  var grid = document.getElementById('projects');
  var filters = document.getElementById('filters');
  var ALL = T.all || 'All';
  var cats = [ALL];
  projects.forEach(function (p) { if (cats.indexOf(p.c) < 0) cats.push(p.c); });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  grid.innerHTML = projects.map(function (p) {
    var links = p.l ? '<span class="links">' + p.l.map(function (x) { return '<a href="' + x[1] + '" target="_blank" rel="noopener">' + esc(x[0]) + '</a>'; }).join('') + '</span>' : '';
    return '<div class="card" data-cat="' + esc(p.c) + '"><div class="card-top"><span class="tag">' + esc(p.c) + '</span><span class="platforms">Android · iOS</span></div><h4>' + esc(p.n) + '</h4><p>' + esc(p.d) + '</p>' + (p.m ? '<span class="metric">' + esc(p.m) + '</span>' : '') + links + '</div>';
  }).join('');
  filters.innerHTML = cats.map(function (c, i) {
    var n = c === ALL ? projects.length : projects.filter(function (p) { return p.c === c; }).length;
    return '<button class="filter" type="button" aria-pressed="' + (i === 0) + '" data-cat="' + esc(c) + '">' + esc(c) + '<span class="n">' + n + '</span></button>';
  }).join('');
  filters.addEventListener('click', function (e) {
    var b = e.target.closest('.filter'); if (!b) return;
    var cat = b.getAttribute('data-cat');
    filters.querySelectorAll('.filter').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    grid.querySelectorAll('.card').forEach(function (card) {
      var show = cat === ALL || card.getAttribute('data-cat') === cat;
      card.classList.toggle('hide', !show);
      card.classList.remove('fade');
      if (show && !reduce) { void card.offsetWidth; card.classList.add('fade'); }
    });
  });

  /* Theme toggle */
  var root = document.documentElement;
  document.getElementById('themeBtn').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('ae-theme', root.getAttribute('data-theme')); } catch (e) {}
  });
  try { var saved = localStorage.getItem('ae-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}

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

  /* Toast + copy */
  var toast = document.getElementById('toast'), tt;
  function say(msg) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('on'); }, 2200); }
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-copy');
      var done = function () { say((S.copied || 'Copied') + ' ' + v); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { selectText(b.previousElementSibling); say(S.copyFallback || 'Press Ctrl+C to copy'); });
      else { selectText(b.previousElementSibling); say(S.copyFallback || 'Press Ctrl+C to copy'); }
    });
  });
  function selectText(el) { var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }

  /* Contact form: builds an email or WhatsApp message */
  var form = document.getElementById('contactForm'), note = document.getElementById('formNote');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var via = (e.submitter && e.submitter.getAttribute('data-via')) || 'email';
    var name = form.name.value.trim(), email = form.email.value.trim(), subject = form.subject.value.trim(), msg = form.message.value.trim();
    if (!name || !msg || (via === 'email' && !/^\S+@\S+\.\S+$/.test(email))) {
      note.textContent = !name ? S.needName : !msg ? S.needMsg : S.badEmail;
      note.classList.add('err'); return;
    }
    note.classList.remove('err');
    var body = msg + '\n\n— ' + name + (email ? ' (' + email + ')' : '');
    var url = via === 'wa'
      ? 'https://wa.me/201023642940?text=' + encodeURIComponent((subject ? subject + '\n\n' : '') + body)
      : 'mailto:atefelsaid3@gmail.com?subject=' + encodeURIComponent(subject || S.defaultSubject || 'Hello from your portfolio') + '&body=' + encodeURIComponent(body);
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    note.textContent = via === 'wa' ? S.openingWa : S.openingMail;
  });
})();
