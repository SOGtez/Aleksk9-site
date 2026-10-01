/* Stream + chat for the homepage (moved from the old index.html, unchanged apart from being wrapped here).
   Needs the markup rendered by src/components/StreamSection.tsx. Uses /api/live, /api/chat and /api/me.
   - Twitch player (embed script, iframe fallback)
   - Chat read live from Twitch over anonymous IRC WebSocket; sending goes through /api/chat
   - "Watch on Twitch" nudge after 5 messages in a session */
/* Runs once per time the homepage is shown. When the page is left and opened again without a reload,
   StreamSection calls window.ak9StreamInit() again: the old chat connection is closed and a new one starts. */
window.ak9StreamInit = function () {
  var root = document.getElementById('stream');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  if (window.__ak9ws) { try { window.__ak9ws.onclose = null; window.__ak9ws.close(); } catch (e) {} }
    function setLiveState(state, meta) {
      var card = document.getElementById('live-card');
      if (!card) return;
      card.dataset.state = state;
      card.querySelector('[data-live-label]').textContent =
        state === 'live' ? 'Live on Twitch' :
        state === 'offline' ? 'Offline right now' : 'Checking stream…';
      if (meta) card.querySelector('[data-live-meta]').textContent = meta;
    }

    /* ==============================================================
       STREAM EMBED + CHAT BOX
       ============================================================== */
    var CHANNEL = 'aieksk9';   /* Twitch login (renamed from aleksk9_ on 2026-09-30) */
    var host = location.hostname || 'localhost';
    var player = document.getElementById('player');
    var playing = false;
    function iframePlayer() {
      player.innerHTML = '<iframe title="AleksK9 live stream" src="https://player.twitch.tv/?channel=' + CHANNEL + '&parent=' + encodeURIComponent(host) + '&muted=true&autoplay=true" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe>';
    }
    (function () {
      var sc = document.createElement('script'); sc.src = 'https://embed.twitch.tv/embed/v1.js'; sc.async = true;
      sc.onload = function () {
        try {
          var embed = new Twitch.Embed('player', { channel: CHANNEL, parent: [host], width: '100%', height: '100%', layout: 'video', muted: true, autoplay: true, theme: 'dark' });
          embed.addEventListener(Twitch.Embed.VIDEO_READY, function () {
            var p = embed.getPlayer();
            p.addEventListener(Twitch.Player.PLAYING, function () { playing = true; });
            p.addEventListener(Twitch.Player.OFFLINE, function () { playing = false; });
          });
        } catch (e) { iframePlayer(); }
      };
      sc.onerror = iframePlayer;
      document.head.appendChild(sc);
    })();

    /* ==============================================================
       SITE CHAT — reads the channel's chat straight from Twitch (anonymous IRC over
       WebSocket) and draws it here. Sending goes through the box below via /api/chat.
       ============================================================== */
    var BADGES = {}, chatLog = document.getElementById('chat-log'), chatJump = document.getElementById('chat-jump'), chatState = document.getElementById('chat-state');
    var MAX_MSGS = 250, pinned = true, ws, wsTries = 0, myLogin = null;
    var PALETTE = ['#FF0000', '#0000FF', '#008000', '#B22222', '#FF7F50', '#9ACD32', '#FF4500', '#2E8B57', '#DAA520', '#D2691E', '#5F9EA0', '#1E90FF', '#FF69B4', '#8A2BE2', '#00FF7F'];
    function nameColor(login, c) { if (c) return c; var h = 0; for (var i = 0; i < login.length; i++) h = (h * 31 + login.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length]; }
    function lighten(hex) { /* keep dark name colours readable on black */
      var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      var lum = 0.299 * r + 0.587 * g + 0.114 * b; if (lum >= 90) return hex; var f = (90 - lum) / 255 + 0.35; return 'rgb(' + Math.min(255, Math.round(r + (255 - r) * f)) + ',' + Math.min(255, Math.round(g + (255 - g) * f)) + ',' + Math.min(255, Math.round(b + (255 - b) * f)) + ')';
    }
    function parseIrc(line) {
      var tags = {}, rest = line, sp, prefix = '';
      if (rest.charAt(0) === '@') { sp = rest.indexOf(' '); rest.slice(1, sp).split(';').forEach(function (kv) { var i = kv.indexOf('='); tags[kv.slice(0, i)] = kv.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\'); }); rest = rest.slice(sp + 1); }
      if (rest.charAt(0) === ':') { sp = rest.indexOf(' '); prefix = rest.slice(1, sp); rest = rest.slice(sp + 1); }
      var trailing = null, ti = rest.indexOf(' :'); if (ti >= 0) { trailing = rest.slice(ti + 2); rest = rest.slice(0, ti); }
      var parts = rest.split(' ');
      return { tags: tags, prefix: prefix, command: parts[0], params: parts.slice(1), trailing: trailing };
    }
    function renderText(text, emotesTag) {
      var chars = Array.from(text), ranges = [];
      if (emotesTag) emotesTag.split('/').forEach(function (e) { var p = e.split(':'); if (p.length < 2) return; p[1].split(',').forEach(function (r) { var se = r.split('-'); ranges.push({ id: p[0], s: +se[0], e: +se[1] }); }); });
      ranges.sort(function (a, b) { return a.s - b.s; });
      var out = '', i = 0;
      ranges.forEach(function (r) {
        if (r.s < i) return;
        out += esc(chars.slice(i, r.s).join(''));
        var code = chars.slice(r.s, r.e + 1).join('');
        out += '<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/' + encodeURIComponent(r.id) + '/default/dark/2.0" alt="' + esc(code) + '" title="' + esc(code) + '">';
        i = r.e + 1;
      });
      return out + esc(chars.slice(i).join(''));
    }
    function addMsg(html, cls, attrs) {
      var el = document.createElement('div'); el.className = 'msg ' + (cls || ''); el.innerHTML = html;
      if (attrs) Object.keys(attrs).forEach(function (k) { el.dataset[k] = attrs[k]; });
      chatLog.appendChild(el);
      while (chatLog.children.length > MAX_MSGS) chatLog.removeChild(chatLog.firstChild);
      if (pinned) chatLog.scrollTop = chatLog.scrollHeight; else chatJump.hidden = false;
    }
    function onPrivmsg(m) {
      var login = (m.prefix.split('!')[0] || '').toLowerCase(), name = m.tags['display-name'] || login;
      var text = m.trailing || '', action = false;
      if (text.charCodeAt(0) === 1 && text.indexOf('ACTION ') === 1) { action = true; text = text.slice(8, -1); }
      var badges = (m.tags.badges || '').split(',').filter(Boolean).map(function (b) { var bd = BADGES[b]; return bd ? '<img class="badge" src="' + esc(bd.url) + '" alt="" title="' + esc(bd.title || b) + '">' : ''; }).join('');
      var color = lighten(nameColor(login, m.tags.color));
      var html = badges + '<span class="name" style="color:' + esc(color) + '">' + esc(name) + '</span>' + (action ? ' ' : ': ') + '<span class="text"' + (action ? ' style="color:' + esc(color) + '"' : '') + '>' + renderText(text, m.tags.emotes) + '</span>';
      addMsg(html, (action ? 'action' : '') + (myLogin && login === myLogin ? ' me' : ''), { id: m.tags.id || '', user: m.tags['user-id'] || '' });
    }
    function onUsernotice(m) {
      var sys = m.tags['system-msg']; if (!sys) return;
      addMsg('<span>' + esc(sys) + '</span>' + (m.trailing ? ' <span class="text">' + renderText(m.trailing, m.tags.emotes) + '</span>' : ''), 'sys');
    }
    function connectChat() {
      if (!document.body.contains(chatLog)) return;   /* page was left */
      try { ws = window.__ak9ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443'); } catch (e) { chatState.textContent = 'chat unavailable'; return; }
      ws.onopen = function () {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands'); ws.send('PASS SCHMOOPIIE'); ws.send('NICK justinfan' + Math.floor(10000 + Math.random() * 89999)); ws.send('JOIN #' + CHANNEL);
        wsTries = 0; chatState.textContent = 'live'; chatState.classList.add('on');
      };
      ws.onmessage = function (ev) {
        ev.data.split('\r\n').forEach(function (line) {
          if (!line) return;
          var m = parseIrc(line);
          if (m.command === 'PING') { ws.send('PONG :tmi.twitch.tv'); return; }
          if (m.command === 'PRIVMSG') onPrivmsg(m);
          else if (m.command === 'USERNOTICE') onUsernotice(m);
          else if (m.command === 'CLEARMSG') { var t = m.tags['target-msg-id']; chatLog.querySelectorAll('.msg').forEach(function (el) { if (el.dataset.id === t) el.classList.add('deleted'); }); }
          else if (m.command === 'CLEARCHAT') { var u = m.tags['target-user-id']; chatLog.querySelectorAll('.msg').forEach(function (el) { if (!u || el.dataset.user === u) el.classList.add('deleted'); }); }
          else if (m.command === 'NOTICE' && m.trailing) addMsg('<span>' + esc(m.trailing) + '</span>', 'sys');
        });
      };
      ws.onclose = function () { chatState.textContent = 'reconnecting…'; chatState.classList.remove('on'); setTimeout(connectChat, Math.min(30000, 1000 * Math.pow(2, wsTries++))); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }
    chatLog.addEventListener('scroll', function () { pinned = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 40; if (pinned) chatJump.hidden = true; });
    chatJump.onclick = function () { pinned = true; chatLog.scrollTop = chatLog.scrollHeight; chatJump.hidden = true; };
    if (location.protocol !== 'file:') fetch('/api/chat?badges=1').then(function (r) { return r.json(); }).then(function (b) { BADGES = b || {}; }).catch(function () {}).finally(connectChat);
    else connectChat();

    if (location.protocol !== 'file:') {
      fetch('/api/live', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.live) setLiveState('live', d.title ? d.title : 'twitch.tv/AIeksK9');
        else { setLiveState('offline', 'twitch.tv/AIeksK9 · follow to get notified'); player.insertAdjacentHTML('beforeend', '<span class="offline-note">Offline right now · chat is still open</span>'); }
      }).catch(function () { setLiveState('offline', 'twitch.tv/AIeksK9'); });
    } else {
      setLiveState('offline', 'twitch.tv/AIeksK9');
    }

    var CHAT = { user: null, canChat: false, count: 0 };
    var POPUP_AT = 5;
    var TWITCH_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:14px;height:14px"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>';
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function chatApi(body) {
      var o = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' } : { cache: 'no-store', credentials: 'same-origin' };
      return fetch('/api/chat', o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || j.error || 'Failed'); e.code = j.error; throw e; } return j; }); });
    }
    function renderComposer(note) {
      var el = document.getElementById('composer');
      var loginHref = '/api/auth/login?scope=chat&next=/';
      if (!CHAT.user) {
        el.innerHTML = '<span class="hint">Want to chat from here?</span><a class="btn btn-ghost btn-sm" href="' + loginHref + '">' + TWITCH_ICON + 'Log in with Twitch</a>';
        return;
      }
      if (!CHAT.canChat) {
        el.innerHTML = '<span class="hint">One more step to chat from the site.</span><a class="btn btn-primary btn-sm" href="' + loginHref + '">Enable chat</a>';
        return;
      }
      el.innerHTML = '<span class="who">' + (CHAT.user.avatar ? '<img src="' + esc(CHAT.user.avatar) + '" alt="">' : '') + '</span>' +
        '<input type="text" id="chat-input" maxlength="500" placeholder="' + esc(note || 'Say something in chat…') + '" autocomplete="off">' +
        '<button class="btn btn-primary btn-sm" id="chat-send" type="button">Send</button>';
      var input = document.getElementById('chat-input'), send = document.getElementById('chat-send');
      function go() {
        var msg = input.value.trim(); if (!msg) return;
        send.disabled = true; input.disabled = true;
        chatApi({ message: msg }).then(function (r) {
          CHAT.count = r.count; input.value = '';
          if (r.count >= POPUP_AT && !sessionStorage.getItem('ak9_app_nudge')) showAppModal();
        }).catch(function (e) {
          if (e.code === 'relogin') { CHAT.canChat = false; renderComposer(); return; }
          input.placeholder = e.message;
        }).finally(function () { send.disabled = false; input.disabled = false; input.focus(); });
      }
      send.onclick = go;
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    }
    function showAppModal() {
      var m = document.getElementById('app-modal'); m.hidden = false;
      try { sessionStorage.setItem('ak9_app_nudge', '1'); } catch (e) {}
      document.getElementById('app-modal-later').onclick = function () { m.hidden = true; };
      document.getElementById('app-modal-go').onclick = function () { setTimeout(function () { m.hidden = true; }, 300); };
      m.onclick = function (e) { if (e.target === m) m.hidden = true; };
    }
    if (location.protocol !== 'file:') {
      chatApi().then(function (d) { CHAT = d; myLogin = d.user ? d.user.login : null; renderComposer(); }).catch(function () { renderComposer(); });
      var q = new URLSearchParams(location.search).get('login');
      if (q) history.replaceState(null, '', location.pathname + '#stream');
    } else { renderComposer(); }

};
window.ak9StreamInit();
