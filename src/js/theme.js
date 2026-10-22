/* Light/dark toggle. The inline script in <head> applies the saved choice before first paint. */
(function () {
  var root = document.documentElement;
  document.getElementById('themeBtn').addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('ae-theme', root.getAttribute('data-theme')); } catch (e) {}
  });
  try { var saved = localStorage.getItem('ae-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
})();
