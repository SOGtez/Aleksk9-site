/* Shared header behaviour for the plain-HTML pages: the Twitch account button on the right
   ("Log in", or the user's picture with Admin / Log out), the same as the Next.js header. */
(function () {
  var TW = '<svg fill="currentColor" viewBox="0 0 512 512" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M391.17,103.47H352.54v109.7h38.63ZM285,103H246.37V212.75H285ZM120.83,0,24.31,91.42V420.58H140.14V512l96.53-91.42h77.25L487.69,256V0ZM449.07,237.75l-77.22,73.12H294.61l-67.6,64v-64H140.14V36.58H449.07Z"></path></svg>';
  var SHIELD = '<svg fill="currentColor" viewBox="0 0 256 256" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M216,56v56c0,96-88,120-88,120S40,208,40,112V56a8,8,0,0,1,8-8H208A8,8,0,0,1,216,56Z" opacity="0.2"></path><path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z"></path></svg>';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var el = document.getElementById('ou-account');
  if (el) {
    var here = encodeURIComponent(location.pathname);
    fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (me) {
      if (!me || !me.user) { el.innerHTML = '<a class="ou-tb" href="/api/auth/login?next=' + here + '">' + TW + '<span class="lbl">Log in</span></a>'; return; }
      el.innerHTML = (me.role === 'admin' ? '<a class="ou-tb" href="/admin">' + SHIELD + '<span class="lbl">Admin</span></a>' : '') +
        '<a class="ou-tb" href="/api/auth/logout?next=' + here + '" title="Log out ' + esc(me.user.name || me.user.login) + '">' +
        (me.user.avatar ? '<img src="' + esc(me.user.avatar) + '" alt="">' : '') + '<span class="lbl">Log out</span></a>';
    }).catch(function () {});
  }
  var y = document.querySelectorAll('[data-year]');
  for (var i = 0; i < y.length; i++) y[i].textContent = new Date().getFullYear();
})();
