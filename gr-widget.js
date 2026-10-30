// GOLDEN RATIO · ويدجت الآيفون (تطبيق Scriptable) — الكود الأساسي (ينزل بروحه من الموقع ويتحدث)
// المتغير TOKEN يجي من الكود القصير اللي بتلصقه بـ Scriptable
// خانة Parameter بإعدادات الويدجت: اكتب M15 لشموع الربع ساعة (الافتراضي: الساعة)
const PARAM = String((typeof args !== "undefined" && args.widgetParameter) || "").trim().toUpperCase();
const API = "https://vrimrmltlmmwapxpvgeh.supabase.co/functions/v1/widget?t=" + TOKEN + (PARAM === "M15" ? "&tf=M15" : "");
const APP = "https://gapnhrt-oss.github.io/golden-ratio-app/#chart";

const C = {
  bg1: new Color("#0B0C28"), bg2: new Color("#161A52"), gold: new Color("#F2B705"), gold2: new Color("#C67F0B"),
  fg: new Color("#EEF0FF"), mut: new Color("#9EA3D6"), up: new Color("#3DD68C"), dn: new Color("#FF6B6B"), line: new Color("#262A66"), liq: new Color("#4FA3FF"),
};
const A = (c, a) => new Color(c.hex, a);
const fam = config.widgetFamily || "medium";
const f2 = v => v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sgn = v => (v >= 0 ? "+" : "") + f2(v);

//--- البيانات (وإذا ما في نت: آخر نسخة محفوظة)
const fm = FileManager.local(), cache = fm.joinPath(fm.cacheDirectory(), "gr-widget.json");
let d = null, stale = false;
try { const r = new Request(API); r.timeoutInterval = 15; d = await r.loadJSON(); if (d && d.ok) fm.writeString(cache, JSON.stringify(d)); else throw new Error("bad"); }
catch (e) { if (fm.fileExists(cache)) { d = JSON.parse(fm.readString(cache)); stale = true; } }

//--- خط سعر صغير (للحجم الصغير)
function spark(vals, w, h, col) {
  const ctx = new DrawContext(); ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true;
  if (!vals || vals.length < 2) return ctx.getImage();
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx - mn) || 1, sx = w / (vals.length - 1);
  const pt = (v, i) => new Point(i * sx, h - 3 - ((v - mn) / rg) * (h - 6));
  const fill = new Path(); fill.move(new Point(0, h)); vals.forEach((v, i) => fill.addLine(pt(v, i))); fill.addLine(new Point(w, h)); fill.closeSubpath();
  ctx.addPath(fill); ctx.setFillColor(A(col, 0.16)); ctx.fillPath();
  const ln = new Path(); vals.forEach((v, i) => i ? ln.addLine(pt(v, i)) : ln.move(pt(v, i)));
  ctx.addPath(ln); ctx.setStrokeColor(col); ctx.setLineWidth(2.2); ctx.strokePath();
  const lp = pt(vals[vals.length - 1], vals.length - 1); ctx.setFillColor(col); ctx.fillEllipse(new Rect(lp.x - 3.5, lp.y - 3.5, 7, 7));
  return ctx.getImage();
}

//--- 🕯️ شارت الشموع + الدعم/المقاومة + السيولة + الترند + الأشكال/الهارمونيك + التوصية
function candleChart(W, H, n, full) {
  const ctx = new DrawContext(); ctx.size = new Size(W, H); ctx.opaque = false; ctx.respectScreenScale = true;
  const cs = (d.candles || []).slice(-n);
  if (cs.length < 3) return ctx.getImage();
  const RM = 44, PW = W - RM, bw = PW / cs.length;
  const t0 = cs[0][0], dt = (cs[cs.length - 1][0] - cs[0][0]) / (cs.length - 1) || 3600;
  const X = t => (t - t0) / dt * bw + bw / 2;
  const sig = d.signal && !d.signal.locked ? d.signal : null;
  let lo = Math.min(...cs.map(c => c[3])), hi = Math.max(...cs.map(c => c[2]));
  const span0 = hi - lo || 10;
  const near = v => v != null && v > lo - span0 * 0.6 && v < hi + span0 * 0.6;
  const extra = [];
  if (sig) { extra.push(sig.entry, sig.sl); if (sig.tps && sig.tps[sig.hit || 0] != null) extra.push(sig.tps[sig.hit || 0]); }
  (d.zones || []).forEach(z => { if (near(z.lo)) extra.push(z.lo, z.hi); });
  extra.filter(v => v != null && near(v)).forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
  const pad = (hi - lo) * 0.06 || 2; lo -= pad; hi += pad;
  const Y = v => H - (v - lo) / (hi - lo) * H;
  const inY = v => v >= lo && v <= hi;
  const line = (x1, y1, x2, y2, col, w) => { const p = new Path(); p.move(new Point(x1, y1)); p.addLine(new Point(x2, y2)); ctx.addPath(p); ctx.setStrokeColor(col); ctx.setLineWidth(w || 1); ctx.strokePath(); };
  const dash = (y, col, w, on, off) => { for (let x = 0; x < PW; x += (on || 5) + (off || 4)) line(x, y, Math.min(PW, x + (on || 5)), y, col, w); };
  const box = (x, y, w, h, col) => { const p = new Path(); p.addRoundedRect(new Rect(x, y, w, h), 3, 3); ctx.addPath(p); ctx.setFillColor(col); ctx.fillPath(); };
  const tag = (txt, x, y, bg, fg, sz) => { const s = sz || 8.5, w = Math.max(16, txt.length * s * 0.62 + 8), h = s + 6; box(x - w / 2, y - h / 2, w, h, bg); ctx.setFont(Font.boldSystemFont(s)); ctx.setTextColor(fg); ctx.setTextAlignedCenter(); ctx.drawTextInRect(txt, new Rect(x - w / 2, y - h / 2 + 2, w, h)); };
  const usedR = [];
  const right = (txt, y, bg, fg) => { for (let k = 0; k < 6 && usedR.some(u => Math.abs(u - y) < 14); k++) y += (y > H / 2 ? -14 : 14); usedR.push(y); box(PW + 2, y - 7, RM - 3, 14, bg); ctx.setFont(Font.boldSystemFont(8.5)); ctx.setTextColor(fg); ctx.setTextAlignedCenter(); ctx.drawTextInRect(txt, new Rect(PW + 2, y - 5.5, RM - 3, 12)); };

  //--- 🧱 الدعم والمقاومة (أحمر فوق السعر · أخضر تحت)
  (d.zones || []).forEach(z => {
    if (!inY(z.lo) && !inY(z.hi)) return;
    const res = (z.lo + z.hi) / 2 > cs[cs.length - 1][4], col = res ? C.dn : C.up, y1 = Y(Math.max(z.lo, z.hi)), y2 = Y(Math.min(z.lo, z.hi));
    const hh = Math.max(3, y2 - y1); ctx.setFillColor(A(col, 0.16)); ctx.fillRect(new Rect(0, (y1 + y2) / 2 - hh / 2, PW, hh));
    if (full) { ctx.setFont(Font.boldSystemFont(7.5)); ctx.setTextColor(A(col, 0.95)); ctx.setTextAlignedLeft(); ctx.drawTextInRect((res ? "مقاومة " : "دعم ") + "⭐".repeat(Math.min(5, z.s || 1)), new Rect(3, (y1 + y2) / 2 - 11, 120, 10)); }
  });
  //--- 💧 السيولة
  (d.liq || []).forEach(l => { if (!inY(l.p)) return; const y = Y(l.p); dash(y, A(C.liq, 0.8), 1, 2, 3); if (full) { ctx.setFont(Font.mediumSystemFont(7.5)); ctx.setTextColor(C.liq); ctx.setTextAlignedRight(); ctx.drawTextInRect("💧 " + l.n, new Rect(PW - 152, y + 1, 150, 10)); } });
  //--- 📈 خطوط الترند (صاعد أخضر · هابط أحمر)
  if (full) (d.tl || []).forEach(t => {
    const ax = X(t.a[0]), bx = X(t.b[0]); if (bx === ax) return;
    const k = (t.b[1] - t.a[1]) / (t.b[0] - t.a[0]), at = tt => t.a[1] + k * (tt - t.a[0]);
    const tA = Math.max(t.a[0], t0), tB = cs[cs.length - 1][0];
    const yA = at(tA), yB = at(tB); if ((!inY(yA) && !inY(yB)) || tA >= tB) return;
    line(X(tA), Y(yA), X(tB), Y(yB), A(t.d === 1 ? C.up : C.dn, 0.85), 1.4);
  });
  //--- 📐🦈 الأشكال الفنية والهارمونيك (صعود أخضر · نزول أحمر)
  if (full) (d.shapes || []).forEach(s => {
    const col = s.d === 1 ? C.up : C.dn;
    if (s.k === "harm" && s.pts && s.pts.length >= 3) {
      const P = s.pts.map(p => new Point(X(p[0]), Y(p[1])));
      const tri = (a, b, c) => { const p = new Path(); p.move(a); p.addLine(b); p.addLine(c); p.closeSubpath(); ctx.addPath(p); ctx.setFillColor(A(col, 0.22)); ctx.fillPath(); };
      if (P.length >= 3) tri(P[0], P[1], P[2]);
      if (P.length >= 5) tri(P[2], P[3], P[4]);
      for (let i = 1; i < P.length; i++) line(P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, col, 1.6);
      if (P.length >= 5) { line(P[0].x, P[0].y, P[4].x, P[4].y, A(col, 0.5), 1); line(P[1].x, P[1].y, P[3].x, P[3].y, A(col, 0.5), 1); }
      const L = ["X", "A", "B", "C", "D"].slice(5 - P.length);
      P.forEach((p, i) => tag(L[i], p.x, p.y + (s.pts[i][1] > (s.pts[i - 1] || s.pts[i + 1])[1] ? -7 : 7), col, new Color("#0B0C28"), 8));
      if (s.tp != null && inY(s.tp)) dash(Y(s.tp), A(col, 0.9), 1, 3, 3);
    } else if (s.zz && s.zz.length >= 2) {
      const P = s.zz.map(p => new Point(X(p[0]), Y(p[1])));
      if (s.lv != null) { const p = new Path(); p.move(new Point(P[0].x, Y(s.lv))); P.forEach(q => p.addLine(q)); p.addLine(new Point(P[P.length - 1].x, Y(s.lv))); p.closeSubpath(); ctx.addPath(p); ctx.setFillColor(A(col, 0.2)); ctx.fillPath(); line(P[0].x, Y(s.lv), PW, Y(s.lv), A(col, 0.9), 1.2); }
      for (let i = 1; i < P.length; i++) line(P[i - 1].x, P[i - 1].y, P[i].x, P[i].y, col, 1.6);
      if (s.tp != null && inY(s.tp)) dash(Y(s.tp), A(col, 0.9), 1, 3, 3);
    }
  });
  //--- 🕯️ الشموع
  cs.forEach((c, i) => {
    const [, o, h, l, cl] = c, x = i * bw + bw / 2, col = cl >= o ? C.up : C.dn;
    line(x, Y(h), x, Y(l), col, 1);
    const y1 = Y(Math.max(o, cl)), y2 = Y(Math.min(o, cl));
    ctx.setFillColor(col); ctx.fillRect(new Rect(x - bw * 0.33, y1, Math.max(1.2, bw * 0.66), Math.max(1.2, y2 - y1)));
  });
  //--- 🟡 السعر الحين
  const last = cs[cs.length - 1][4], yl = Y(last);
  line(0, yl, PW, yl, A(C.gold, 0.7), 0.8);
  right(String(Math.round(last)), yl, C.gold, new Color("#1A1300"));
  //--- 🟢🛑 التوصية
  if (sig) {
    const ec = sig.side === "sell" ? C.dn : C.up;
    if (inY(sig.entry)) { dash(Y(sig.entry), ec, 1.3, 6, 3); right("دخول", Y(sig.entry), ec, new Color("#0B0C28")); }
    if (inY(sig.sl)) { dash(Y(sig.sl), C.dn, 1.3, 6, 3); right("وقف", Y(sig.sl), C.dn, new Color("#2A0505")); }
    const nx = sig.tps && sig.tps[sig.hit || 0]; if (nx != null && inY(nx)) { dash(Y(nx), C.gold, 1.1, 3, 3); right("🎯" + ((sig.hit || 0) + 1), Y(nx), A(C.gold, 0.85), new Color("#1A1300")); }
  }
  return ctx.getImage();
}
function txt(st, s, size, col, bold) { const t = st.addText(s); t.font = bold ? Font.boldSystemFont(size) : Font.mediumSystemFont(size); t.textColor = col; t.lineLimit = 1; t.minimumScaleFactor = 0.6; return t; }

//--- سطر التوصية
function sigLine() {
  if (!d) return null;
  const s = d.signal, p = d.pending;
  if (s && s.locked) return { t: (s.side === "sell" ? "🔴 توصية بيع" : "🟢 توصية شراء") + " شغالة · 🔒 VIP", c: C.gold };
  if (s) {
    const mv = s.move, c = mv == null ? C.fg : mv >= 0 ? C.up : C.dn;
    return { t: (s.side === "sell" ? "🔴 بيع" : "🟢 شراء") + " " + f2(s.entry) + (mv == null ? "" : " · " + sgn(mv) + "$") + (s.hit ? " · ✅🎯" + s.hit : ""), c, s };
  }
  if (p && p.locked) return { t: "⏳ " + (p.side === "sell" ? "توصية بيع" : "توصية شراء") + " تتجهز · 🔒", c: C.gold };
  if (p) return { t: "⏳ " + (p.side === "sell" ? "بيع" : "شراء") + " يتجهز · " + p.score + "/10 (يحتاج " + p.need + ")", c: C.gold, p };
  return { t: "📡 ما في توصية الحين", c: C.mut };
}

const up = d && d.change != null ? d.change >= 0 : true, pc = up ? C.up : C.dn;
const tfName = d && d.tf === "M15" ? "M15" : "H1";

//--- 🖼️ خلفية الشاشة (من الاختصارات: Run Script + المدخل "wallpaper" ← Set Wallpaper)
const WALL = (typeof args !== "undefined" && /wall/i.test(String(args.shortcutParameter || args.plainTexts && args.plainTexts[0] || ""))) || PARAM === "WALLPAPER";
function wallpaper() {
  const WW = 430, HH = 932, ctx = new DrawContext(); ctx.size = new Size(WW, HH); ctx.opaque = true; ctx.respectScreenScale = true;
  //--- خلفية متدرجة (شرايط)
  const top = [27, 32, 96], bot = [5, 6, 26];
  for (let i = 0; i < 60; i++) { const k = i / 59, c = top.map((v, j) => Math.round(v + (bot[j] - v) * k)); ctx.setFillColor(new Color("#" + c.map(v => v.toString(16).padStart(2, "0")).join(""))); ctx.fillRect(new Rect(0, i * HH / 60, WW, HH / 60 + 1)); }
  const T = (t, x, y, w, sz, col, al, bold) => { ctx.setFont(bold ? Font.boldSystemFont(sz) : Font.mediumSystemFont(sz)); ctx.setTextColor(col); al === "c" ? ctx.setTextAlignedCenter() : al === "r" ? ctx.setTextAlignedRight() : ctx.setTextAlignedLeft(); ctx.drawTextInRect(t, new Rect(x, y, w, sz + 8)); };
  if (!d) { T("GOLDEN RATIO", 0, 430, WW, 22, C.gold, "c", true); return ctx.getImage(); }
  const Y0 = 300;   // فوق فاضي حق الساعة
  T("GOLDEN RATIO · " + tfName, 20, Y0, 220, 14, C.gold, "l", true);
  T(f2(d.price), 180, Y0 - 6, 230, 26, C.fg, "r", true);
  if (d.changePct != null) T((up ? "▲ " : "▼ ") + sgn(d.change) + "  " + d.changePct.toFixed(2) + "%", 180, Y0 + 26, 230, 13, pc, "r", true);
  ctx.drawImageInRect(candleChart(390, 330, 40, true), new Rect(20, Y0 + 52, 390, 330));
  //--- التوصية
  const sl = sigLine(), by = Y0 + 396;
  if (sl) {
    const p = new Path(); p.addRoundedRect(new Rect(20, by, 390, sl.s ? 78 : 40), 12, 12); ctx.addPath(p); ctx.setFillColor(new Color("#0B0C28", 0.75)); ctx.fillPath();
    T(sl.t, 32, by + 10, 366, 15, sl.c, "r", true);
    if (sl.s) {
      T("🛑 الوقف " + f2(sl.s.sl) + (sl.s.be ? " · 🔒 مأمّن" : ""), 32, by + 32, 366, 12, C.mut, "r");
      T((sl.s.tps || []).map((t, i) => (i < sl.s.hit ? "✅" : "🎯") + Math.round(t)).join("   "), 32, by + 52, 366, 12, C.fg, "r", true);
    }
  }
  if (d.shapes && d.shapes.length) T(d.shapes.slice(0, 3).map(s => (s.k === "harm" ? "🦈 " : "📐 ") + s.n + " " + s.tf).join("   ·   "), 20, by + (sl && sl.s ? 88 : 50), 390, 11, C.gold, "r", true);
  T("آخر تحديث " + new Date(d.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "  ·  أعلى " + f2(d.high) + "  ·  أدنى " + f2(d.low), 20, by + 112, 390, 10, C.mut, "c");
  return ctx.getImage();
}
if (WALL) {
  const img = wallpaper();
  if (config.runsInApp) QuickLook.present(img, true);
  Script.setShortcutOutput(img);
  Script.complete();
  return;
}

const w = new ListWidget();
w.url = APP;
w.refreshAfterDate = new Date(Date.now() + 5 * 60e3);

if (fam === "accessoryInline") {
  txt(w, "🥇 " + (d ? f2(d.price) : "—") + (d && d.changePct != null ? " " + (up ? "▲" : "▼") + Math.abs(d.changePct).toFixed(2) + "%" : ""), 12, C.fg, true);
} else if (fam === "accessoryRectangular") {
  txt(w, "🥇 الذهب " + (d ? f2(d.price) : "—"), 14, C.fg, true);
  if (d && d.changePct != null) txt(w, (up ? "▲ " : "▼ ") + sgn(d.change) + " (" + d.changePct.toFixed(2) + "%)", 11, C.fg);
  const sl = sigLine(); if (sl) txt(w, sl.t, 11, C.fg);
} else if (fam === "accessoryCircular") {
  const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
  txt(s, "🥇", 12, C.fg); txt(s, d ? String(Math.round(d.price)) : "—", 13, C.fg, true);
} else {
  const g = new LinearGradient(); g.colors = [C.bg2, C.bg1]; g.locations = [0, 1]; w.backgroundGradient = g;
  w.setPadding(fam === "small" ? 12 : 10, 12, fam === "small" ? 12 : 10, 12);
  if (!d) { txt(w, "GOLDEN RATIO", 11, C.gold, true); w.addSpacer(6); txt(w, "ما قدرت أجيب البيانات", 13, C.mut); }
  else if (fam === "small") {
    const hd = w.addStack(); hd.centerAlignContent();
    const brand = txt(hd, "GOLDEN RATIO", 10, C.gold, true); brand.minimumScaleFactor = 0.8;
    if (stale) { hd.addSpacer(); txt(hd, "📴", 9, C.mut); }
    w.addSpacer(4);
    txt(w, "XAUUSD · الذهب", 10, C.mut);
    txt(w, f2(d.price), 22, C.fg, true);
    if (d.changePct != null) txt(w, (up ? "▲ " : "▼ ") + d.changePct.toFixed(2) + "%", 11, pc, true);
    w.addSpacer(4);
    const img = w.addImage(spark(d.spark, 130, 30, pc)); img.imageSize = new Size(130, 30);
    w.addSpacer();
    const sl = sigLine(); if (sl) txt(w, sl.t, 10, sl.c, true);
  } else {
    const large = fam === "large" || fam === "extraLarge";
    //--- الرأس: الاسم + الفريم · السعر + التغيّر
    const hd = w.addStack(); hd.centerAlignContent();
    txt(hd, "GOLDEN RATIO · " + tfName, 11, C.gold, true);
    hd.addSpacer();
    txt(hd, f2(d.price), large ? 18 : 16, C.fg, true);
    if (d.changePct != null) { hd.addSpacer(5); txt(hd, (up ? "▲" : "▼") + Math.abs(d.changePct).toFixed(2) + "%", 10, pc, true); }
    w.addSpacer(4);
    //--- الشارت
    const CW = 316, CH = large ? 214 : 88;
    const img = w.addImage(candleChart(CW, CH, large ? 40 : 30, large)); img.imageSize = new Size(CW, CH);
    w.addSpacer(large ? 5 : 3);
    //--- أسماء الأشكال (الكبير)
    if (large && d.shapes && d.shapes.length) {
      const tg = w.addStack(); tg.spacing = 6;
      d.shapes.slice(0, 3).forEach(s => { const b = tg.addStack(); b.backgroundColor = A(s.d === 1 ? C.up : C.dn, 0.18); b.cornerRadius = 6; b.setPadding(2, 6, 2, 6); txt(b, (s.k === "harm" ? "🦈 " : "📐 ") + s.n + " " + s.tf, 9, s.d === 1 ? C.up : C.dn, true); });
      w.addSpacer(4);
    }
    //--- التوصية
    const sl = sigLine();
    if (sl) {
      const bx = w.addStack(); bx.layoutVertically(); bx.backgroundColor = A(C.bg1, 0.7); bx.cornerRadius = 9; bx.setPadding(large ? 6 : 4, 8, large ? 6 : 4, 8);
      const r1 = bx.addStack(); r1.centerAlignContent();
      txt(r1, sl.t, large ? 12 : 11, sl.c, true);
      if (!large && d.shapes && d.shapes.length) { r1.addSpacer(); txt(r1, (d.shapes[0].k === "harm" ? "🦈 " : "📐 ") + d.shapes[0].n, 9, d.shapes[0].d === 1 ? C.up : C.dn, true); }
      if (large && sl.s) {
        bx.addSpacer(3);
        txt(bx, "🛑 الوقف " + f2(sl.s.sl) + (sl.s.be ? " · 🔒 مأمّن" : "") + (sl.s.strength ? " · 💪 " + sl.s.strength + "/10" : ""), 10, C.mut);
        const tp = bx.addStack(); tp.spacing = 6;
        (sl.s.tps || []).forEach((t, i) => txt(tp, (i < sl.s.hit ? "✅" : "🎯") + Math.round(t), 10, i < sl.s.hit ? C.up : C.fg, true));
      }
      if (large && sl.p && sl.p.wait && sl.p.wait.length) { bx.addSpacer(2); sl.p.wait.forEach(x => txt(bx, "⏳ " + x, 9.5, C.mut)); }
    }
    if (large) { w.addSpacer(); const ft = w.addStack(); txt(ft, "أعلى " + f2(d.high) + "  ·  أدنى " + f2(d.low), 9, C.mut); ft.addSpacer(); txt(ft, stale ? "📴 محفوظ" : new Date(d.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), 9, C.mut); }
  }
}

if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(w);
else if (fam === "large") await w.presentLarge();
else await w.presentMedium();
Script.complete();
