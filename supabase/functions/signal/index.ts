// GOLDEN RATIO — استقبال التوصيات والأخبار والشارت من بوت MT5 (هيدر x-bot-key) + feed لمنفّذ التوصيات + نتائج الاكسبيرت + سجل التقييم (للإدارة) + التوصية اللي تتجهز + 𝕏 تويتر + 📲 واتساب خاص + أزرار القنوات + ⚡ سكالب تجريبي · v22: قسم التوصية (sec) · v23: حجم التك (السيولة) مع الشموع · v24: لقطة الأشكال والترندات وقت التوصية (signals.shape) للأمثلة الحية
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let KEY = "";
async function loadKey() { if (KEY) return; const { data } = await db.from("app_secrets").select("value").eq("name", "bot_key").maybeSingle(); KEY = data?.value ?? ""; }
const num = (v: unknown) => (v === null || v === undefined || v === "" || Number(v) === 0 ? null : Number(v));
const numZ = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
const KINDS = ["idea", "enter", "qtp", "tp1", "tp2", "tp3", "tp4", "tp5", "partial", "be", "sl", "close", "cancel", "note"];
const RESULTS = ["qtp", "tp1", "tp2", "tp3", "tp4", "tp5", "be", "sl"];
const POST_KINDS = ["morning", "free_signal", "results", "announcement"];
const SECS = ["rec", "scalp", "inv", "ea"];
const TFS = ["M1", "M5", "M15", "H1", "H4", "D1"];
// 📏 نخلي شموع كافية علشان المتوسطات لين 2150 تطلع على كل الفريمات (البوت v6.90 يرسل 3000 شمعة لكل فريم) · v20: دقيقة و 5 دقايق للسكالب
const KEEP: Record<string, number> = { M1: 10 * 864e2, M5: 30 * 864e2, M15: 50 * 864e2, H1: 200 * 864e2, H4: 750 * 864e2, D1: 4400 * 864e2 };
const emsg = (e: unknown) => { const x = e as Record<string, unknown>; return String((x && (x.message || x.details || x.hint)) ?? e); };
const z = (v: unknown) => (v === null || v === undefined ? "0" : String(v));

// 🔍 v24: لقطة من الأشكال (هارمونيك/أشكال فنية) وخطوط الترند والمناطق اللي كانت على الشارت وقت التوصية — علشان «الأمثلة الحية» ترسمها بالضبط
async function shapeSnap(side: string) {
  try {
    const { data } = await db.from("chart_levels").select("data,updated_at").eq("id", 1).maybeSingle();
    const L = (data?.data ?? {}) as Record<string, any>;
    const d = side === "sell" ? -1 : 1;
    const arr = (v: unknown) => (Array.isArray(v) ? v : []);
    const shapes = arr(L.shapes).filter((s: any) => s && s.k !== "idea" && (s.d === d || s.d === undefined)).slice(0, 6);
    const tl = arr(L.tl).slice(0, 10);
    const zones = arr(L.zones).slice(0, 8);
    const sz = arr(L.sz).filter((s: any) => s && (s.d === d || s.d === undefined)).slice(0, 6);
    if (!shapes.length && !tl.length && !zones.length && !sz.length) return null;
    const snap = { at: Math.floor(Date.now() / 1000), lv_at: data?.updated_at ?? null, shapes, tl, zones, sz };
    return JSON.stringify(snap).length > 60000 ? { at: snap.at, lv_at: snap.lv_at, shapes, tl } : snap;
  } catch (e) { console.error("shapeSnap", emsg(e)); return null; }
}

// 𝕏 ينشر الحدث بتويتر بالخلفية (ما يأخر رد البوت)
function xEvent(sid: string, kind: string, price: unknown) {
  const p = fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/xpost", { method: "POST", headers: { "Content-Type": "application/json", "x-bot-key": KEY }, body: JSON.stringify({ action: "event", sid, kind, price: num(price) }) })
    .then((r) => r.text()).catch((e) => console.error("xpost", String(e)));
  try { (globalThis as any).EdgeRuntime?.waitUntil(p); } catch (_) { /* */ }
}
const X_KINDS = ["qtp", "tp1", "tp2", "tp3", "tp4", "tp5"];
// 📲 الواتساب الخاص للمشتركين (طابور بالسيرفر)
function waEvent(sid: string, kind: string, price: unknown) {
  const p = fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/wa", { method: "POST", headers: { "Content-Type": "application/json", "x-bot-key": KEY }, body: JSON.stringify({ action: "enqueue", sid, kind, price: num(price) }) })
    .then((r) => r.text()).catch((e) => console.error("wa", String(e)));
  try { (globalThis as any).EdgeRuntime?.waitUntil(p); } catch (_) { /* */ }
}
const WA_KINDS = ["qtp", "tp1", "tp2", "tp3", "tp4", "tp5", "sl", "be", "close"];
function fan(sid: string, kind: string, price: unknown) {
  if (kind === "new" || X_KINDS.includes(kind)) xEvent(sid, kind, price);
  if (kind === "new" || WA_KINDS.includes(kind)) waEvent(sid, kind, price);
}

Deno.serve(async (req) => {
  await loadKey();
  if (!KEY || req.headers.get("x-bot-key") !== KEY) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    const raw = (await req.text()).replace(/\u0000+$/g, "").trim();
    let b: Record<string, any>;
    try { b = JSON.parse(raw); } catch (pe) {
      const m = /position (\d+)/.exec(String(pe)); const at = m ? Number(m[1]) : 0;
      console.error("bad json", String(pe), "len", raw.length, "near:", raw.slice(Math.max(0, at - 160), at + 60));
      throw new Error("bad json: " + String(pe));
    }

    if (b.action === "ping") return Response.json({ ok: true, pong: true });

    // ⚡ v20: صفقة سكالب تجريبية سكرت (صامتة — للإدارة بس)
    if (b.action === "scalp") {
      const T = (v: unknown, n: number) => (v === null || v === undefined ? null : String(v).slice(0, n));
      const B = (v: unknown) => v === true || v === 1 || v === "1";
      const row = {
        created: new Date(Number(b.t) * 1000).toISOString(), closed: b.tc ? new Date(Number(b.tc) * 1000).toISOString() : new Date().toISOString(),
        tf: T(b.tf, 4), setup: T(b.st, 12), side: b.d === -1 || b.d === "-1" ? "sell" : "buy",
        entry: numZ(b.e), sl: numZ(b.sl), risk: numZ(b.risk), result: T(b.res, 8), pl: numZ(b.pl), hit5: B(b.h5), mfe: numZ(b.mfe), mae: numZ(b.mae),
        sr: Math.round(Number(b.sr) || 0), liq: B(b.liq), harm: B(b.harm), pat: B(b.pat), smc: B(b.smc), ma_with: B(b.ma), h1_with: B(b.h1), tags: T(b.tags, 300),
      };
      if (!row.tf || !row.setup || isNaN(+new Date(row.created))) throw new Error("bad scalp");
      const { error } = await db.from("scalp_trades").insert(row);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    // 🎛️ أزرار القنوات من لوحة الإدارة — البوت يسأل كل دقيقة: "cfg|wa_me|wa_group|tg_me|tg_vip|tg_pub"
    if (b.action === "cfg") {
      const { data } = await db.from("app_secrets").select("name,value").in("name", ["ch_wa_me", "ch_wa_group", "ch_tg_me", "ch_tg_vip", "ch_tg_pub"]);
      const m: Record<string, string> = {}; (data || []).forEach((r) => m[r.name] = r.value);
      const g = (k: string) => (m[k] === "0" ? "0" : "1");
      return new Response("cfg|" + [g("ch_wa_me"), g("ch_wa_group"), g("ch_tg_me"), g("ch_tg_vip"), g("ch_tg_pub")].join("|"), { headers: { "Content-Type": "text/plain" } });
    }

    // 🧪 فكرة انمنعت (ما دخلنا) + ليش + شنو صار بعدها — للإدارة بس
    if (b.action === "filtered") {
      const T = (v: unknown, n: number) => (v === null || v === undefined ? null : String(v).slice(0, n));
      const row = {
        created: b.created ? new Date(Number(b.created) * 1000).toISOString() : null,
        side: b.side === "SELL" || b.side === "sell" ? "sell" : "buy", sys: T(b.sys, 10), score: b.score ? Math.round(Number(b.score)) : null,
        zlo: num(b.zlo), zhi: num(b.zhi), entry: num(b.entry), sl: num(b.sl), tp2: num(b.tp2), reason: T(b.reason, 300), result: T(b.result, 20),
      };
      const { error } = await db.from("signal_filtered").insert(row);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    // ⏳ التوصية اللي تتجهز (أو أقرب فكرة idea): القوة + الشروط (المشتركين يشوفون الشروط بس، والمدير الكل)
    if (b.action === "pend") {
      const d = b.on ? { on: true, idea: !!b.idea, dist: numZ(b.dist), side: b.side === "sell" ? "sell" : "buy", sys: String(b.sys ?? "").slice(0, 10), tf: String(b.tf ?? "").slice(0, 20),
        score: Number(b.score) || 0, base: Number(b.base) || 0, need: Number(b.need) || 8, since: b.since ? new Date(Number(b.since) * 1000).toISOString() : null,
        zlo: num(b.zlo), zhi: num(b.zhi), mid: num(b.mid), sl: num(b.sl), sw: b.sw ? String(b.sw).slice(0, 200) : "",
        checks: (Array.isArray(b.checks) ? b.checks : []).slice(0, 12).map((c: Record<string, unknown>) => ({ ok: !!c.ok, t: String(c.t ?? "").slice(0, 160), ta: String(c.ta ?? c.t ?? "").slice(0, 200) })) } : { on: false };
      const { error } = await db.from("pending_status").upsert({ id: 1, data: d, updated_at: new Date().toISOString() });
      if (error) throw error;
      return Response.json({ ok: true });
    }

    // 📨 الرسايل الخاصة (اللي توصلك إنت بس) — نسخة للإدارة
    if (b.action === "log") {
      const body = b.body ? String(b.body).slice(0, 4000) : "";
      if (!body) throw new Error("body required");
      const { error } = await db.from("bot_msgs").insert({ body });
      if (error) throw error;
      return Response.json({ ok: true });
    }

    // 📈 نتائج الاكسبيرت (GR_Results.mq5): لقطة وحدة تنعرض بصفحة «نتائج الاكسبيرت»
    if (b.action === "ea") {
      const N = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
      const months = (Array.isArray(b.months) ? b.months : []).slice(-36).map((m: Record<string, unknown>) => ({ m: String(m.m ?? "").slice(0, 7), p: N(m.p), pct: N(m.pct), n: N(m.n), w: N(m.w) }));
      const curve = (Array.isArray(b.curve) ? b.curve : []).slice(-400).filter((r: unknown) => Array.isArray(r) && r.length >= 2).map((r: unknown[]) => [Math.round(Number(r[0])), N(r[1])]);
      const data: Record<string, unknown> = { months, curve, demo: !!b.demo, name: b.name ? String(b.name).slice(0, 40) : null, start: b.start ? Math.round(Number(b.start)) : null, cur: b.cur ? String(b.cur).slice(0, 5) : "USD" };
      for (const k of ["balance", "equity", "deposit", "profit", "growth", "win", "trades", "baskets", "bwin", "dd_max", "dd_max_pct", "dd_now", "open_n", "open_lots", "open_pl", "best", "worst", "days"]) data[k] = N(b[k]);
      const { error } = await db.from("ea_snap").upsert({ id: 1, data, updated_at: new Date().toISOString() });
      if (error) throw error;
      return Response.json({ ok: true });
    }

    // 🤖 feed لمنفّذ التوصيات (نص بسيط سطر سطر علشان MQL5 يقراه بسهولة)
    // S|ext|status|side|entry|sl|tp1|tp2|tp3|tp4|tp5|created_epoch
    // U|ext|kind|price|epoch
    if (b.action === "feed") {
      const since = new Date(Date.now() - 3 * 864e5).toISOString();
      const { data: sg, error } = await db.from("signals").select("id,ext_id,status,side,entry_from,sl,tp1,tp2,tp3,tp4,tp5,created_at,closed_at")
        .or("status.in.(open,idea),closed_at.gte." + since).order("created_at", { ascending: true }).limit(30);
      if (error) throw error;
      const ids = (sg || []).map((s) => s.id);
      const { data: up } = ids.length ? await db.from("signal_updates").select("signal_id,kind,price,created_at").in("signal_id", ids).order("created_at", { ascending: true }) : { data: [] };
      const ex: Record<string, string> = {}; (sg || []).forEach((s) => ex[s.id] = s.ext_id || ("M-" + String(s.id).slice(0, 13)));   // توصية يدوية من لوحة الإدارة
      let out = "OK|" + Math.floor(Date.now() / 1000) + "\n";
      (sg || []).forEach((s) => out += ["S", ex[s.id], s.status, s.side, z(s.entry_from), z(s.sl), z(s.tp1), z(s.tp2), z(s.tp3), z(s.tp4), z(s.tp5), Math.floor(+new Date(s.created_at) / 1000)].join("|") + "\n");
      (up || []).forEach((u) => out += ["U", ex[u.signal_id], u.kind, z(u.price), Math.floor(+new Date(u.created_at) / 1000)].join("|") + "\n");
      return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // 📈 الشارت · v23: العنصر السادس (إذا موجود) = حجم التك من MT5 (السيولة)
    if (b.action === "chart") {
      let n = 0;
      if (b.candles && typeof b.candles === "object") {
        for (const tf of TFS) {
          const arr = b.candles[tf];
          if (!Array.isArray(arr) || !arr.length) continue;
          const seen = new Map<number, Record<string, unknown>>();
          arr.filter((r: unknown) => Array.isArray(r) && r.length >= 5).forEach((r: number[]) => { const t = Math.round(Number(r[0])); if (!isFinite(t)) return;
            const row: Record<string, unknown> = { tf, t, o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]) };
            if (r.length >= 6 && isFinite(Number(r[5]))) row.v = Math.max(0, Math.min(2147483647, Math.round(Number(r[5]))));
            seen.set(t, row); });
          const all = [...seen.values()];
          //--- الصفوف اللي فيها v واللي بدونها بدفعات منفصلة (علشان البوت القديم ما يمسح السيولة)
          for (const rows of [all.filter((r) => "v" in r), all.filter((r) => !("v" in r))]) {
            for (let i = 0; i < rows.length; i += 1000) { const { error } = await db.from("chart_candles").upsert(rows.slice(i, i + 1000)); if (error) throw error; }
          }
          n += all.length;
          if (all.length > 50) await db.from("chart_candles").delete().eq("tf", tf).lt("t", Math.floor(Date.now() / 1000) - KEEP[tf]);
        }
      }
      if (b.levels && typeof b.levels === "object") {
        const { error } = await db.from("chart_levels").upsert({ id: 1, data: b.levels, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      return Response.json({ ok: true, candles: n });
    }

    if (b.action === "reaction") {
      const ts = new Date(String(b.ts));
      if (isNaN(+ts)) throw new Error("ts required");
      const row: Record<string, unknown> = { ts: ts.toISOString(), updated_at: new Date().toISOString() };
      if (b.name) row.name = String(b.name).slice(0, 120);
      if (b.expected !== undefined) row.expected = Math.max(-1, Math.min(1, Math.round(Number(b.expected) || 0)));
      for (const k of ["p0", "m5", "m15", "m60"]) if (k in b) row[k] = numZ(b[k]);
      const { error } = await db.from("news_reactions").upsert(row);
      if (error) throw error;
      return Response.json({ ok: true });
    }

    if (b.action === "post") {
      const body = b.body ? String(b.body).slice(0, 4000) : "";
      if (!body) throw new Error("body required");
      const row = {
        kind: POST_KINDS.includes(b.kind) ? b.kind : "announcement",
        audience: b.audience === "public" ? "public" : "members",
        title: b.title ? String(b.title).slice(0, 200) : null,
        body,
      };
      const { data, error } = await db.from("posts").insert(row).select("id").single();
      if (error) throw error;
      return Response.json({ ok: true, id: data.id });
    }

    const ext = String(b.ext_id ?? "").trim();
    if (!ext) throw new Error("ext_id required");
    const { data: cur } = await db.from("signals").select("id,status").eq("ext_id", ext).maybeSingle();

    if (b.action === "new") {
      if (cur) return Response.json({ ok: true, id: cur.id, dup: true });
      const side = String(b.side).toLowerCase().startsWith("s") ? "sell" : "buy";
      const row = {
        ext_id: ext, pair: b.pair || "XAUUSD", side, status: b.status === "idea" ? "idea" : "open",
        entry_from: num(b.entry_from), entry_to: num(b.entry_to), sl: num(b.sl), tp_quick: num(b.tp_quick),
        tp1: num(b.tp1), tp2: num(b.tp2), tp3: num(b.tp3), tp4: num(b.tp4), tp5: num(b.tp5),
        strength: b.strength ? Math.max(1, Math.min(10, Math.round(Number(b.strength)))) : null,
        reason: b.reason ? String(b.reason).slice(0, 1500) : null, is_free: !!b.is_free,
        sec: SECS.includes(String(b.sec)) ? String(b.sec) : null,   // 🗂️ v22: قسم التوصية من البوت v7.19
        shape: (b.shape && typeof b.shape === "object") ? b.shape : await shapeSnap(side),   // 🔍 v24
      };
      if (row.entry_from === null) throw new Error("entry_from required");
      const { data, error } = await db.from("signals").insert(row).select("id").single();
      if (error) throw error;
      if (row.status === "open") fan(data.id, "new", null);
      return Response.json({ ok: true, id: data.id });
    }
    if (!cur) throw new Error("signal not found: " + ext);

    if (b.action === "update") {
      const kind = KINDS.includes(b.kind) ? b.kind : "note";
      const { error } = await db.from("signal_updates").insert({ signal_id: cur.id, kind, price: num(b.price), body: b.body ? String(b.body).slice(0, 300) : null });
      if (error) throw error;
      // v19: نحدّث التوصية (الدخول/الوقف/الأسباب) قبل ما نرسل للواتساب علشان الرسالة تطلع بالأرقام النهائية
      if (kind === "enter") {
        const up: Record<string, unknown> = {};
        if (cur.status === "idea") up.status = "open";
        if (num(b.entry) !== null) { up.entry_from = num(b.entry); up.entry_to = null; }
        if ("tp_quick" in b) up.tp_quick = num(b.tp_quick);
        if (num(b.sl) !== null) up.sl = num(b.sl);
        if (b.reason) up.reason = String(b.reason).slice(0, 1500);
        if (b.ladder) for (const t of ["tp1", "tp2", "tp3", "tp4", "tp5"]) up[t] = num(b[t]);
        // 🔍 v24: لقطة الأشكال لحظة الدخول الفعلي (الفكرة تتحول توصية)
        if (cur.status === "idea") { const { data: sd } = await db.from("signals").select("side").eq("id", cur.id).maybeSingle(); const sh = await shapeSnap(sd?.side ?? "buy"); if (sh) up.shape = sh; }
        if (Object.keys(up).length) await db.from("signals").update(up).eq("id", cur.id);
      }
      fan(cur.id, kind, b.price);
      if (kind === "enter" && cur.status === "idea") fan(cur.id, "new", null);
      // 📍 v19: وصل الدخول 2 ← رسالة واتساب خاص للمشتركين
      if (kind === "note" && /^📍 وصل الدخول 2/.test(String(b.body ?? ""))) waEvent(cur.id, "e2", b.price);
      return Response.json({ ok: true });
    }
    if (b.action === "close") {
      const result = RESULTS.includes(b.result) ? b.result : null;
      const { error } = await db.from("signals").update({ status: "closed", result, move: b.move === undefined ? null : Number(b.move), closed_at: new Date().toISOString() }).eq("id", cur.id);
      if (error) throw error;
      await db.from("signal_updates").insert({ signal_id: cur.id, kind: "close", price: num(b.price), body: b.body ? String(b.body).slice(0, 300) : null });
      // 🏁 v21: الإغلاق = صورة «انتهت التوصية» للكل (بدل رسالة النص وتكرار صورة الهدف) · الوقف نفس قبل
      if (result === "sl") fan(cur.id, "sl", b.price);
      else if (result) waEvent(cur.id, "close", b.price);
      return Response.json({ ok: true });
    }
    if (b.action === "cancel") {
      await db.from("signals").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", cur.id);
      await db.from("signal_updates").insert({ signal_id: cur.id, kind: "cancel", body: b.body ? String(b.body).slice(0, 300) : null });
      return Response.json({ ok: true });
    }
    throw new Error("unknown action");
  } catch (e) {
    console.error("signal error:", emsg(e));
    return Response.json({ ok: false, error: emsg(e) }, { status: 400 });
  }
});
