// 図の対応表（figures.json）を読み、既存の問題に図を付ける。問題文や習熟度は変えない。
// 使い方: node scripts/set-oral-exam-figures.mjs figures.json [--dry-run]
// figures.json: [{ "book": 参考書名, "type": 種類（数学A など）, "number": 問題番号, "figures": ["yellow-chart/ma-084-1.png", ...] }]
// 対応表に出てくる参考書は、いったん全問の図を外してから付け直す（何度実行しても同じ結果になる）。
// "items": [{ "sub", "prompt", "answer", "speech" }] がある問題は、図が無くて非表示にしていた問題を作り直したもの。
// 同じ小問番号の問題を上書きして表示に戻し（ID はそのまま）、無い小問は追加する。
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!inputPath) throw new Error("figures.json を指定してください。");
const entries = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(entries) || !entries.length) throw new Error("図の対応表が空です。");

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "app.db");
if (!existsSync(dbPath)) throw new Error(`DBがありません: ${dbPath}`);
const missing = [...new Set(entries.flatMap((e) => e.figures))].filter((fig) => !/^[\w-]+(?:\/[\w.-]+)*\.(?:png|jpg|jpeg|webp)$/i.test(fig) || !existsSync(path.join(dataDir, "oral-exam-figures", fig)));
if (missing.length) throw new Error(`図のファイルがありません: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` ほか${missing.length - 5}件` : ""}`);

const db = new DatabaseSync(dbPath);
try { db.exec("ALTER TABLE oral_exam_questions ADD COLUMN figures_json TEXT NOT NULL DEFAULT ''"); } catch (e) { if (!String(e).includes("duplicate column")) throw e; }
const bookIds = new Map();
for (const title of new Set(entries.map((e) => e.book))) {
  const book = db.prepare("SELECT id FROM oral_exam_books WHERE title = ?").get(title);
  if (!book) throw new Error(`参考書台帳が見つかりません: ${title}`);
  bookIds.set(title, book.id);
}
const find = db.prepare("SELECT id FROM oral_exam_questions WHERE book_id = ? AND problem_type = ? AND problem_number = ?");
const plan = entries.map((e) => ({ ...e, ids: find.all(bookIds.get(e.book), e.type, e.number).map((r) => r.id) }));
const notFound = plan.filter((p) => !p.ids.length).map((p) => `${p.type} ${p.number}`);
const findSub = db.prepare("SELECT id FROM oral_exam_questions WHERE book_id = ? AND problem_type = ? AND problem_number = ? AND sub_label = ? ORDER BY blocked, created_at DESC");
const restores = plan.filter((p) => Array.isArray(p.items)).flatMap((p) => p.items.map((item) => ({ ...item, entry: p, id: findSub.get(bookIds.get(p.book), p.type, p.number, item.sub ?? "")?.id ?? null })));
console.log(`図つきの問題: ${plan.filter((p) => p.ids.length).length}問（小問 ${plan.reduce((n, p) => n + p.ids.length, 0)}件） / 図 ${new Set(entries.flatMap((e) => e.figures)).size}枚`);
if (restores.length) console.log(`作り直して出題に戻す小問: ${restores.length}件（上書き ${restores.filter((r) => r.id).length}件 / 追加 ${restores.filter((r) => !r.id).length}件）`);
if (notFound.length) console.log(`DB に無い問題（図を付けない）: ${notFound.join("、")}`);
if (dryRun) process.exit(0);

const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
copyFileSync(dbPath, path.join(dataDir, `app.db.bak-${stamp}`));
db.exec("BEGIN IMMEDIATE");
try {
  for (const id of bookIds.values()) db.prepare("UPDATE oral_exam_questions SET figures_json = '' WHERE book_id = ?").run(id);
  const now = new Date().toISOString();
  const update = db.prepare("UPDATE oral_exam_questions SET prompt = ?, model_answer = ?, speech_text = ?, blocked = 0, reviewed_at = ? WHERE id = ?");
  const sibling = db.prepare("SELECT category, problem_type, question_kind, MAX(order_index) AS last FROM oral_exam_questions WHERE book_id = ? AND problem_type = ? AND problem_number = ?");
  const insert = db.prepare(`INSERT INTO oral_exam_questions (id, book_id, order_index, problem_number, sub_label, problem_type, question_kind, category, prompt, model_answer, speech_text, grading_json, created_at, reviewed_at, blocked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 0)`);
  for (const r of restores) {
    if (r.id) { update.run(r.prompt, r.answer, r.speech ?? "", now, r.id); continue; }
    const bookId = bookIds.get(r.entry.book); const near = sibling.get(bookId, r.entry.type, r.entry.number);
    insert.run(crypto.randomUUID(), bookId, near?.last ?? 0, r.entry.number, r.sub ?? "", r.entry.type, near?.question_kind ?? "", near?.category ?? "", r.prompt, r.answer, r.speech ?? "", now, now);
  }
  const ids = db.prepare("SELECT id FROM oral_exam_questions WHERE book_id = ? AND problem_type = ? AND problem_number = ?");
  const set = db.prepare("UPDATE oral_exam_questions SET figures_json = ? WHERE id = ?");
  for (const p of plan) for (const { id } of ids.all(bookIds.get(p.book), p.type, p.number)) set.run(JSON.stringify(p.figures), id);
  db.exec("COMMIT");
  console.log(`図の付け直し完了（バックアップ: app.db.bak-${stamp}）`);
} catch (e) { db.exec("ROLLBACK"); throw e; }
