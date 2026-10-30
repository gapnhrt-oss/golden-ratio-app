// GOLDEN RATIO · ويدجت الآيفون (تطبيق Scriptable) — الكود الأساسي (ينزل بروحه من الموقع ويتحدث)
// المتغير TOKEN يجي من الكود القصير اللي بتلصقه بـ Scriptable
const API = "https://vrimrmltlmmwapxpvgeh.supabase.co/functions/v1/widget?t=" + TOKEN;
const APP = "https://gapnhrt-oss.github.io/golden-ratio-app/#chart";

const C = {
  bg1: new Color("#0B0C28"), bg2: new Color("#161A52"), gold: new Color("#F2B705"), gold2: new Color("#C67F0B"),
  fg: new Color("#EEF0FF"), mut: new Color("#9EA3D6"), up: new Color("#3DD68C"), dn: new Color("#FF6B6B"), line: new Color("#262A66"),
};
const fam = config.widgetFamily || "medium";
const f2 = v => v == null ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sgn = v => (v >= 0 ? "+" : "") + f2(v);

//--- البيانات (وإذا ما في نت: آخر نسخة محفوظة)
const fm = FileManager.local(), cache = fm.joinPath(fm.cacheDirectory(), "gr-widget.json");
let d = null, stale = false;
try { const r = new Request(API); r.timeoutInterval = 15; d = await r.loadJSON(); if (d && d.ok) fm.writeString(cache, JSON.stringify(d)); else throw new Error("bad"); }
catch (e) { if (fm.fileExists(cache)) { d = JSON.parse(fm.readString(cache)); stale = true; } }

//--- شارت صغير
function spark(vals, w, h, col) {
  const ctx = new DrawContext(); ctx.size = new Size(w, h); ctx.opaque = false; ctx.respectScreenScale = true;
  if (!vals || vals.length < 2) return ctx.getImage();
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx - mn) || 1, sx = w / (vals.length - 1);
  const pt = (v, i) => new Point(i * sx, h - 3 - ((v - mn) / rg) * (h - 6));
  const fill = new Path(); fill.move(new Point(0, h)); vals.forEach((v, i) => fill.addLine(pt(v, i))); fill.addLine(new Point(w, h)); fill.closeSubpath();
  ctx.addPath(fill); ctx.setFillColor(new Color(col.hex, 0.16)); ctx.fillPath();
  const ln = new Path(); vals.forEach((v, i) => i ? ln.addLine(pt(v, i)) : ln.move(pt(v, i)));
  ctx.addPath(ln); ctx.setStrokeColor(col); ctx.setLineWidth(2.2); ctx.strokePath();
  const lp = pt(vals[vals.length - 1], vals.length - 1); ctx.setFillColor(col); ctx.fillEllipse(new Rect(lp.x - 3.5, lp.y - 3.5, 7, 7));
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

const w = new ListWidget();
w.url = APP;
w.refreshAfterDate = new Date(Date.now() + 5 * 60e3);
const up = d && d.change != null ? d.change >= 0 : true, pc = up ? C.up : C.dn;

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
  w.setPadding(12, 14, 12, 14);
  //--- الرأس
  const hd = w.addStack(); hd.centerAlignContent();
  const brand = txt(hd, "GOLDEN RATIO", fam === "small" ? 10 : 11, C.gold, true); brand.minimumScaleFactor = 0.8;
  if (fam !== "small" || stale) { hd.addSpacer(); txt(hd, stale ? "📴" : (d ? new Date(d.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""), 9, C.mut); }
  w.addSpacer(fam === "small" ? 4 : 6);
  if (!d) { txt(w, "ما قدرت أجيب البيانات", 13, C.mut); }
  else {
    const body = w.addStack(); body.layoutHorizontally();
    const left = body.addStack(); left.layoutVertically();
    txt(left, "XAUUSD · الذهب", 10, C.mut);
    txt(left, f2(d.price), fam === "small" ? 22 : 26, C.fg, true);
    if (d.changePct != null) txt(left, (up ? "▲ " : "▼ ") + sgn(d.change) + "  " + d.changePct.toFixed(2) + "%", 11, pc, true);
    if (fam !== "small") {
      body.addSpacer(8);
      const img = body.addImage(spark(d.spark, 150, 62, pc)); img.imageSize = new Size(150, 62);
    } else {
      left.addSpacer(4);
      const img = left.addImage(spark(d.spark, 130, 30, pc)); img.imageSize = new Size(130, 30);
    }
    w.addSpacer();
    //--- التوصية
    const sl = sigLine();
    if (sl) {
      const box = w.addStack(); box.backgroundColor = new Color("#0B0C28", 0.65); box.cornerRadius = 10; box.setPadding(6, 8, 6, 8); box.layoutVertically();
      txt(box, sl.t, fam === "small" ? 10 : 12, sl.c, true);
      if (fam === "large" && sl.s) {
        box.addSpacer(4);
        txt(box, "🛑 الوقف " + f2(sl.s.sl) + (sl.s.be ? " · 🔒 مأمّن" : ""), 11, C.mut);
        const tp = box.addStack(); tp.spacing = 6;
        sl.s.tps.forEach((t, i) => txt(tp, (i < sl.s.hit ? "✅" : "🎯") + Math.round(t), 10, i < sl.s.hit ? C.up : C.fg));
      }
      if (fam === "large" && sl.p && sl.p.wait && sl.p.wait.length) { box.addSpacer(3); sl.p.wait.forEach(x => txt(box, "⏳ " + x, 10, C.mut)); }
    }
    if (fam === "large") {
      w.addSpacer(6);
      const ft = w.addStack(); txt(ft, "أعلى " + f2(d.high) + "  ·  أدنى " + f2(d.low), 10, C.mut);
    }
  }
}

if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
