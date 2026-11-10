// GOLDEN RATIO — service worker
// ⚡ يفتح فوراً من النسخة المحفوظة، والتحديث ينزل بالخلفية (ويطلع «✨ تحديث جديد»)
// 📴 بدون نت: آخر بيانات محفوظة
let wasOff = false;
const SHELL_C = 'gr-shell-v13', LIB_C = 'gr-lib-v1', DATA_C = 'gr-data';
const SHELL = ['./', './index.html', './manifest.json', './icon-512.png', './icon-192.png', './logo-80.webp'];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];
const SB_HOST = 'vrimrmltlmmwapxpvgeh.supabase.co';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_C).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => ![SHELL_C, LIB_C, DATA_C, 'gr-badge'].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const tell = msg => self.clients.matchAll({ type: 'window' }).then(l => l.forEach(c => c.postMessage(msg)));
const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

// الصفحة: من المحفوظ على طول + نجيب الجديد بالخلفية
async function shell(req) {
  const c = await caches.open(SHELL_C);
  const key = req.mode === 'navigate' ? './index.html' : req;
  const old = await c.match(key);
  const net = fetch(req.mode === 'navigate' ? './index.html' : req, { cache: 'no-cache' }).then(async res => {
    if (res && res.ok) {
      if (old && req.mode === 'navigate') {
        const [a, b] = await Promise.all([old.clone().text(), res.clone().text()]);
        if (a !== b) tell({ type: 'updated' });
      }
      await c.put(key, res.clone());
    }
    return res;
  });
  if (old) { net.catch(() => {}); return old; }
  return net.catch(() => c.match('./index.html'));
}

// المكتبات (إصدارات ثابتة): من المحفوظ، وإذا مو موجودة من النت
async function lib(req) {
  const c = await caches.open(LIB_C);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
  return res;
}

// بيانات Supabase: من النت أول، وإذا ما فيه نت آخر نسخة محفوظة
async function data(req) {
  const c = await caches.open(DATA_C);
  try {
    const res = await timeout(fetch(req), 15000);
    if (res && res.ok) {
      if (wasOff) { wasOff = false; tell({ type: 'online' }); }
      c.put(req, res.clone()).then(() => c.keys()).then(k => { if (k.length > 120) k.slice(0, k.length - 120).forEach(x => c.delete(x)); }).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await c.match(req);
    if (hit) { wasOff = true; tell({ type: 'offline' }); return hit; }
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.search && req.mode !== 'navigate') return;                // فحص النسخة (?v=) يروح للنت على طول
    if (req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname)) { e.respondWith(shell(req)); return; }
    e.respondWith(caches.match(req).then(r => r || fetch(req)).catch(() => fetch(req)));
    return;
  }
  if (LIB_HOSTS.includes(url.hostname)) { e.respondWith(lib(req)); return; }
  if (url.hostname === SB_HOST && (url.pathname.startsWith('/rest/v1/') || url.pathname === '/functions/v1/gold-price')) {
    if (url.pathname.startsWith('/rest/v1/chart_candles')) return;   // الشموع محفوظة بالصفحة نفسها
    e.respondWith(data(req));
  }
});

// إشعار يوصل من السيرفر حتى لو التطبيق مسكّر
// 🔢 علامة على أيقونة التطبيق (الآيفون كتطبيق) — عدد اللي وصل وانت برا · تنمسح أول ما تفتح التطبيق
async function bumpBadge() {
  try {
    const c = await caches.open('gr-badge'), r = await c.match('n'), n = (r ? Number(await r.text()) || 0 : 0) + 1;
    await c.put('n', new Response(String(n)));
    if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
  } catch (_) {}
}
// 🌐 الإشعار بلغة الزائر (English / Türkçe): نترجمه هني (3 ثواني بالكثير) — وإذا ما مشى يطلع عربي
async function swLang() { try { const c = await caches.open('gr-badge'), r = await c.match('lang'); return r ? (await r.text()) : 'ar'; } catch (_) { return 'ar'; } }
async function swTr(d) {
  const lang = await swLang(); if (lang !== 'en' && lang !== 'tr') return d;
  const T = [d.title || '', d.body || ''], AR = /[\u0600-\u06FF]/; if (!AR.test(T.join(''))) return d;
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=' + lang + '&dt=t&q=' + encodeURIComponent(T.join('\n')), { signal: ctl.signal });
    clearTimeout(tm); const j = await r.json(), out = ((j[0] || []).map(p => p[0]).join('')).split('\n').map(x => x.trim());
    return out.length >= 2 ? Object.assign({}, d, { title: out[0] || d.title, body: out.slice(1).join(' ') || d.body }) : d;
  } catch (_) { return d; }
}
self.addEventListener('push', e => {
  let d0 = {}; try { d0 = e.data ? e.data.json() : {}; } catch (_) { d0 = { title: 'GOLDEN RATIO', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([
    swTr(d0).then(d => self.registration.showNotification(d.title || 'GOLDEN RATIO', {
      body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || undefined, data: { url: d.url || './' }
    })),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const front = list.some(c => c.visibilityState === 'visible');
      list.forEach(c => { try { c.postMessage({ t: 'push', tag: d0.tag || '' }); } catch (_) {} });
      return front ? null : bumpBadge();            // التطبيق قدامك = ما نحط علامة
    })
  ]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    const target = (e.notification.data && e.notification.data.url) || './#signals';
    for (const c of list) { if ('focus' in c) { c.navigate(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
