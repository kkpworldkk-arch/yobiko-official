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

if (args.includes("--build-rebuilt")) {
  // 例題ごとの作り直し結果（yellow-chart-rebuild.py）から final.json を作る。
  // 既存の小問は同じ小問番号の新データで上書き（ID はそのまま）、余った新データは追加、
  // 新データに対応しない既存の小問と、検算で矛盾が残った小問は非表示にする（回答履歴は残る）。
  const questions = JSON.parse(readFileSync("data/yellow-chart/questions.json", "utf8"));
  const rebuilt = new Map();
  for (const line of readFileSync("data/yellow-chart/rebuilt.jsonl", "utf8").split(String.fromCharCode(10))) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (!r.error && r.found !== false && r.items?.length) rebuilt.set(r.key, r);
  }
  const byExample = new Map();
  for (const q of questions) {
    const key = `${q.book}|${q.part}|${q.number}`;
    if (!byExample.has(key)) byExample.set(key, []);
    byExample.get(key).push(q);
  }
  const updates = [];
  const inserts = [];
  const review = [];
  const stats = { rebuilt: 0, untouched: 0, updated: 0, inserted: 0, hidden: 0, review: 0 };
  const grading = (item) => ({
    requiredKeywords: item.keywords ?? [], acceptedVariants: item.accepted ?? [],
    misconceptions: item.misconceptions ?? [], numericAnswer: item.numeric_answer ?? "", significantFigures: null,
  });
  const allKeys = new Set([...byExample.keys(), ...rebuilt.keys()]);
  for (const key of allKeys) {
    const old = byExample.get(key) ?? [];
    const r = rebuilt.get(key);
    if (!r) {
      // 作り直せなかった例題は、記法だけ直した既存データのまま
      stats.untouched += old.length;
      for (const q of old) updates.push({ id: q.id, prompt: q.prompt, answer: q.answer, blocked: false });
      continue;
    }
    stats.rebuilt += 1;
    const bad = new Set((r.check === "needs_review" ? r.issues ?? [] : []).map((i) => i.sub));
    const unusedOld = [...old];
    const take = (sub) => {
      const i = unusedOld.findIndex((q) => q.sub === sub);
      return i >= 0 ? unusedOld.splice(i, 1)[0] : null;
    };
    const pending = [];
    for (const item of r.items) {
      const match = take(item.sub);
      if (match) pending.push([item, match]);
      else pending.push([item, null]);
    }
    // 小問番号の付け方が変わった（例：既存は番号なし1件、新しくは (1)(2)）ときは、残りを順に対応させる
    for (const pair of pending) if (!pair[1] && unusedOld.length) pair[1] = unusedOld.shift();
    for (const [item, match] of pending) {
      const blocked = bad.has(item.sub);
      if (blocked) {
        stats.review += 1;
        review.push({ key, sub: item.sub, prompt: item.prompt, answer: item.answer });
      }
      const data = {
        prompt: item.prompt.trim(), answer: item.answer.trim(), speech: item.speech?.trim() ?? "",
        grading: grading(item), blocked, sub: item.sub,
      };
      if (match) {
        stats.updated += 1;
        updates.push({ id: match.id, ...data });
      } else {
        stats.inserted += 1;
        inserts.push({
          book: r.book, part: r.part, number: r.number,
          category: r.category || `${r.book} - ${r.part} ${r.kind}例題 ${r.title}`.trim(), ...data,
        });
      }
    }
    for (const q of unusedOld) {
      stats.hidden += 1;
      updates.push({ id: q.id, prompt: q.prompt, answer: q.answer, blocked: true });
    }
  }
  writeFileSync("data/yellow-chart/final.json", JSON.stringify({ updates, inserts }, null, 1));
  writeFileSync("data/yellow-chart/needs-review.json", JSON.stringify(review, null, 1));
  console.log(`作り直した例題 ${stats.rebuilt} / 上書き ${stats.updated} / 追加 ${stats.inserted} / 対応なしで非表示 ${stats.hidden} / 検算で矛盾が残り非表示 ${stats.review} / 作り直せず既存のまま ${stats.untouched}`);
  process.exit(0);
}

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
// アプリを新しい版で一度も起動していない DB でも動くよう、必要な列を用意しておく
for (const definition of ["problem_number INTEGER", "sub_label TEXT NOT NULL DEFAULT ''", "problem_type TEXT NOT NULL DEFAULT ''", "question_kind TEXT NOT NULL DEFAULT ''", "speech_text TEXT NOT NULL DEFAULT ''", "grading_json TEXT NOT NULL DEFAULT ''"]) {
  try { db.exec(`ALTER TABLE oral_exam_questions ADD COLUMN ${definition}`); }
  catch (error) { if (!String(error).includes("duplicate column")) throw error; }
}

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
const update = db.prepare(
  `UPDATE oral_exam_questions
   SET prompt = ?, model_answer = ?, blocked = ?, reviewed_at = ?,
       speech_text = COALESCE(?, speech_text), grading_json = COALESCE(?, grading_json),
       question_kind = CASE WHEN ? IS NULL THEN question_kind ELSE 'solve' END,
       sub_label = COALESCE(?, sub_label)
   WHERE id = ?`,
);
const nextIndex = db.prepare("SELECT COALESCE(MAX(order_index), -1) + 1 AS n FROM oral_exam_questions WHERE book_id = ?");
const insert = db.prepare(
  `INSERT INTO oral_exam_questions
     (id, book_id, order_index, problem_number, sub_label, problem_type, category, prompt, model_answer, created_at, reviewed_at, blocked,
      speech_text, grading_json, question_kind)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'solve')`,
);
db.exec("BEGIN IMMEDIATE");
try {
  for (const u of targets) {
    const rebuilt = u.grading !== undefined;
    update.run(
      u.prompt, u.answer, u.blocked ? 1 : 0, now,
      rebuilt ? u.speech : null, rebuilt ? JSON.stringify(u.grading) : null, rebuilt ? 1 : null, rebuilt ? u.sub : null,
      u.id,
    );
  }
  for (const q of newOnes) {
    const bookId = bookIds.get(q.book);
    insert.run(
      crypto.randomUUID(), bookId, nextIndex.get(bookId).n, q.number, q.sub, q.part, q.category, q.prompt, q.answer, now, now,
      q.blocked ? 1 : 0, q.speech ?? "", JSON.stringify(q.grading ?? {}),
    );
  }
  db.exec("COMMIT");
  console.log("反映しました。");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
