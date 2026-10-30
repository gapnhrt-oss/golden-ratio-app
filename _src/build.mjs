// GOLDEN RATIO — يبني index.html المضغوط من _src/index.html (المصدر اللي نعدل عليه)
// node _src/build.mjs   (يحتاج esbuild)
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let esbuild;
for (const p of ["esbuild", "/opt/npm-tools/node_modules/esbuild"]) { try { esbuild = require(p); break; } catch (_) {} }
if (!esbuild) { console.error("esbuild مو موجود"); process.exit(1); }

const dir = new URL(".", import.meta.url).pathname;
const src = readFileSync(dir + "index.html", "utf8");

// 1) CSS حق الصفحة (أول <style> بالـ head)
const cs = src.indexOf("<style>"), ce = src.indexOf("</style>", cs);
const css = esbuild.transformSync(src.slice(cs + 7, ce), { loader: "css", minify: true }).code.trim();

// 2) الكود الرئيسي (آخر <script> بدون src)
const js0 = src.lastIndexOf("<script>"), js1 = src.lastIndexOf("</script>");
const js = esbuild.transformSync(src.slice(js0 + 8, js1), { loader: "js", minify: true, legalComments: "none", charset: "utf8" }).code.trim();
if (/<\/script/i.test(js)) { console.error("الكود فيه </script>"); process.exit(1); }

// 3) HTML: نشيل التعليقات والمسافات بين الوسوم
const squeeze = t => t.replace(/<!--(?!\[)[\s\S]*?-->/g, "").replace(/>\s+</g, "><").replace(/\n\s*/g, "\n").trim();
const out = squeeze(src.slice(0, cs)) + "<style>" + css + "</style>" + squeeze(src.slice(ce + 8, js0)) + "<script>" + js + "</script>" + squeeze(src.slice(js1 + 9)) + "\n";
writeFileSync(dir + "../index.html", out);
console.log("index.html:", src.length, "→", out.length, "bytes (" + Math.round(out.length / src.length * 100) + "%)");
