/* Topic filter on the blog page. The posts and buttons are rendered at build time; this only shows and hides them. */
(function () {
  var list = document.getElementById('blogPosts');
  var filters = document.getElementById('blogFilters');
  if (!list || !filters) return;
  filters.addEventListener('click', function (e) {
    var b = e.target.closest('.filter'); if (!b) return;
    var cat = b.getAttribute('data-cat');
    filters.querySelectorAll('.filter').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    list.querySelectorAll('.post').forEach(function (p) {
      p.classList.toggle('hide', cat !== 'all' && p.getAttribute('data-cat') !== cat);
    });
  });
})();

/* Copy button on code blocks in articles. */
(function () {
  var labels = { en: 'Copy', ar: 'نسخ' }, done = { en: 'Copied', ar: 'تم النسخ' };
  var lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  document.querySelectorAll('.prose pre').forEach(function (pre) {
    if (!navigator.clipboard) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = labels[lang];
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(pre.querySelector('code').textContent).then(function () {
        b.textContent = done[lang];
        setTimeout(function () { b.textContent = labels[lang]; }, 1600);
      });
    });
    pre.appendChild(b);
  });
})();
