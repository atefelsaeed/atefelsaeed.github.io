/* Projects grid and its industry filter. Data comes from window.SITE (built from content/*.json). */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T = window.SITE || {};
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
})();
