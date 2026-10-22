/* Industry filter on the projects page. The cards and filter buttons are rendered at build time; this only shows and hides them. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ALL = (window.SITE || {}).all || 'All';
  var grid = document.getElementById('projects');
  var filters = document.getElementById('filters');
  if (!grid || !filters) return;

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
