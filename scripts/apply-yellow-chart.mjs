// 黄チャートの点検結果を DB に反映する。
//
// 1) まとめる（このPCで実行）:
//      node scripts/apply-yellow-chart.mjs --build
//    data/yellow-chart/questions.json（記法を直したデータ）と verify-results.jsonl（紙面との照合結果）から
//    data/yellow-chart/final.json を作る。
// 2) 反映する（本番は Render の Shell で、final.json を受け取ってから実行）:
//      node scripts/apply-yellow-chart.mjs final.json --dry-run
//      node scripts/apply-yellow-chart.mjs final.json
//
// 既存の問題は ID をそのまま使って上書きするので、生徒の習熟度・回答履歴はすべて残る。
// 抜けていた例題は新しい問題として追加する（同じ科目・番号・小問がすでにあれば追加しない）。
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);

if (args.includes("--build")) {
  const questions = JSON.parse(readFileSync("data/yellow-chart/questions.json", "utf8"));
  const results = readFileSync("data/yellow-chart/verify-results.jsonl", "utf8")
    .split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
  const checked = new Map();
  for (const result of results.filter((r) => r.mode === "verify")) {
    for (const item of result.items ?? []) checked.set(item.id, item);
  }
  const stats = { ok: 0, fixed: 0, unverifiable: 0, needs_figure: 0, unchecked: 0 };
  const updates = questions.map((q) => {
    const item = checked.get(q.id);
    if (!item) {
      stats.unchecked += 1;
      return { id: q.id, prompt: q.prompt, answer: q.answer, blocked: false };
    }
    stats[item.status] += 1;
    // 照合できなかったものは、記法だけ直した元のデータを使う（推測での書き換えは採用しない）
    const useModel = item.status === "ok" || item.status === "fixed";
    return {
      id: q.id,
      prompt: useModel && item.prompt.trim() ? item.prompt.trim() : q.prompt,
      answer: useModel && item.answer.trim() ? item.answer.trim() : q.answer,
      blocked: item.status === "needs_figure",
    };
  });
  const inserts = [];
  for (const result of results.filter((r) => r.mode === "missing" && r.found)) {
    for (const item of result.items) {
      inserts.push({
        book: result.book, part: result.part, number: result.number, sub: item.sub ?? "",
        category: `${result.book} - ${result.part} ${result.kind}例題 ${result.title}`.trim(),
        prompt: item.prompt.trim(), answer: item.answer.trim(),
      });
    }
  }
  writeFileSync("data/yellow-chart/final.json", JSON.stringify({ updates, inserts }, null, 1));
  console.log(`まとめ: そのまま ${stats.ok} / 修正 ${stats.fixed} / 照合できず ${stats.unverifiable} / 図が必要で非表示 ${stats.needs_figure} / 未点検 ${stats.unchecked} / 追加 ${inserts.length}問`);
  process.exit(0);
}

const inputPath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!inputPath) throw new Error("final.json のパスを指定してください。");
const { updates, inserts } = JSON.parse(readFileSync(inputPath, "utf8"));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "app.db");
if (!existsSync(dbPath)) throw new Error(`DBがありません: ${dbPath}`);
const db = new DatabaseSync(dbPath);

const existing = new Set(db.prepare("SELECT id FROM oral_exam_questions").all().map((r) => r.id));
const targets = updates.filter((u) => existing.has(u.id));
const bookIds = new Map(db.prepare("SELECT id, title FROM oral_exam_books WHERE title LIKE '黄チャート%'").all().map((r) => [r.title, r.id]));
const has = db.prepare("SELECT 1 FROM oral_exam_questions WHERE book_id = ? AND problem_type = ? AND problem_number = ? AND sub_label = ?");
const newOnes = inserts.filter((q) => bookIds.has(q.book) && !has.get(bookIds.get(q.book), q.part, q.number, q.sub));
console.log(`更新 ${targets.length}問（本番に無いID ${updates.length - targets.length}件は無視） / 非表示 ${targets.filter((u) => u.blocked).length}問 / 追加 ${newOnes.length}問`);
if (dryRun) process.exit(0);

const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
copyFileSync(dbPath, path.join(dataDir, `app.db.bak-${stamp}`));
console.log(`バックアップ: app.db.bak-${stamp}`);

const now = new Date().toISOString();
const update = db.prepare("UPDATE oral_exam_questions SET prompt = ?, model_answer = ?, blocked = ?, reviewed_at = ? WHERE id = ?");
const nextIndex = db.prepare("SELECT COALESCE(MAX(order_index), -1) + 1 AS n FROM oral_exam_questions WHERE book_id = ?");
const insert = db.prepare(
  `INSERT INTO oral_exam_questions
     (id, book_id, order_index, problem_number, sub_label, problem_type, category, prompt, model_answer, created_at, reviewed_at, blocked)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
);
db.exec("BEGIN IMMEDIATE");
try {
  for (const u of targets) update.run(u.prompt, u.answer, u.blocked ? 1 : 0, now, u.id);
  for (const q of newOnes) {
    const bookId = bookIds.get(q.book);
    insert.run(crypto.randomUUID(), bookId, nextIndex.get(bookId).n, q.number, q.sub, q.part, q.category, q.prompt, q.answer, now, now);
  }
  db.exec("COMMIT");
  console.log("反映しました。");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
