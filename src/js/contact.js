/* Contact section: copy buttons, toast, and the form that builds an email or WhatsApp message. */
(function () {
  var T = window.SITE || {};
  var S = T.strings || {};
  var C = T.contact || {};

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
  if (form) form.addEventListener('submit', function (e) {
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
      ? 'https://wa.me/' + C.wa + '?text=' + encodeURIComponent((subject ? subject + '\n\n' : '') + body)
      : 'mailto:' + C.email + '?subject=' + encodeURIComponent(subject || S.defaultSubject || 'Hello from your portfolio') + '&body=' + encodeURIComponent(body);
    var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    note.textContent = via === 'wa' ? S.openingWa : S.openingMail;
  });
})();
