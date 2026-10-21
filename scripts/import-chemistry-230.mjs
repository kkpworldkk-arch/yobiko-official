// 化学230選の手入力テンプレートをDBへ置き換える。
// 使い方: node scripts/import-chemistry-230.mjs data/manual-import/chemistry-230.txt [--dry-run]
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!inputPath) throw new Error("chemistry-230.txt のパスを指定してください。");

const splitList = (value) => value ? value.split("/").map((item) => item.trim()).filter(Boolean) : [];
const integer = (value, line, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${line}行目: ${label} は整数で指定してください。`);
  return parsed;
};

function parseTemplate(text) {
  const blocks = [];
  let block = [];
  const flush = () => {
    if (block.some(({ value }) => value.trim())) blocks.push(block);
    block = [];
  };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "---") return flush();
    if (!raw.trim() || raw.trim().startsWith("#")) return;
    const match = /^([A-Z]+):\s?(.*)$/.exec(raw);
    if (!match) {
      const previous = block.at(-1);
      if (!previous || !["Q", "R", "A"].includes(previous.key)) throw new Error(`${line}行目: 項目名がありません。`);
      previous.value += `\n${raw}`;
      previous.lastLine = line;
      return;
    }
    block.push({ key: match[1], value: match[2], line });
  });
  flush();

  const questions = [];
  const seen = new Set();
  for (const entries of blocks) {
    const fields = new Map();
    for (const entry of entries) {
      if (fields.has(entry.key)) throw new Error(`${entry.line}行目: ${entry.key} が重複しています。`);
      fields.set(entry.key, entry);
    }
    const required = ["N", "C", "P", "AP", "T", "Q", "A"];
    for (const key of required) if (!fields.get(key)?.value.trim()) throw new Error(`${fields.get("N")?.line ?? entries[0].line}行目付近: ${key} がありません。`);
    const n = integer(fields.get("N").value.trim(), fields.get("N").line, "N");
    if (n < 1 || n > 230) throw new Error(`${fields.get("N").line}行目: N は1〜230です。`);
    const kind = fields.get("T").value.trim();
    if (kind !== "recall" && kind !== "solve") throw new Error(`${fields.get("T").line}行目: T は recall または solve です。`);
    const sourcePage = integer(fields.get("P").value.trim(), fields.get("P").line, "P");
    const answerPage = integer(fields.get("AP").value.trim(), fields.get("AP").line, "AP");
    const subLabel = fields.get("S")?.value.trim() ?? "";
    const key = `${n}|${subLabel}`;
    if (seen.has(key)) throw new Error(`${fields.get("N").line}行目: NとSが重複しています (${key})。`);
    seen.add(key);
    const numericAnswer = fields.get("U")?.value.trim() ?? "";
    if (kind === "solve" && !numericAnswer) throw new Error(`${fields.get("T").line}行目: T: solve には U が必要です。`);
    const sig = fields.get("SIG")?.value.trim() ?? "";
    const significantFigures = sig ? integer(sig, fields.get("SIG").line, "SIG") : null;
    questions.push({
      problemNumber: n, subLabel, chapter: fields.get("C").value.trim(), sourcePage, answerPage,
      questionKind: kind, prompt: fields.get("Q").value.trim(), speechText: fields.get("R")?.value.trim() ?? "",
      modelAnswer: fields.get("A").value.trim(),
      grading: { requiredKeywords: splitList(fields.get("K")?.value.trim()), acceptedVariants: splitList(fields.get("OK")?.value.trim()), misconceptions: splitList(fields.get("NG")?.value.trim()), numericAnswer, significantFigures },
    });
  }
  if (questions.length === 0) throw new Error("取り込める問題がありません。");
  return questions;
}

const questions = parseTemplate(readFileSync(inputPath, "utf8"));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "app.db");
if (!existsSync(dbPath)) throw new Error(`DBがありません: ${dbPath}`);
const db = new DatabaseSync(dbPath);
const book = db.prepare("SELECT id FROM oral_exam_books WHERE title = ?").get("化学頻出スタンダード問題230選");
if (!book) throw new Error("化学230選の参考書台帳が見つかりません。");
const bookId = book.id;
const old = db.prepare("SELECT * FROM oral_exam_questions WHERE book_id = ? ORDER BY order_index").all(bookId);
const missing = [...new Set(Array.from({ length: 230 }, (_, i) => i + 1).filter((n) => !questions.some((q) => q.problemNumber === n)))];
console.log(`新データ: ${questions.length}小問 / 旧データ: ${old.length}問 / 欠番: ${missing.length ? missing.join(",") : "なし"}`);
if (dryRun) process.exit(0);

mkdirSync(dataDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
const backup = path.join(dataDir, `app.db.bak-${stamp}`);
copyFileSync(dbPath, backup);
console.log(`バックアップ: ${backup}`);

db.exec("BEGIN IMMEDIATE");
try {
  for (const definition of ["problem_number INTEGER", "sub_label TEXT NOT NULL DEFAULT ''", "question_kind TEXT NOT NULL DEFAULT ''", "speech_text TEXT NOT NULL DEFAULT ''", "grading_json TEXT NOT NULL DEFAULT ''"]) {
    try { db.exec(`ALTER TABLE oral_exam_questions ADD COLUMN ${definition}`); }
    catch (error) { if (!String(error).includes("duplicate column")) throw error; }
  }
  const oldMastery = old.flatMap((row) => db.prepare("SELECT * FROM oral_exam_mastery WHERE question_id = ?").all(row.id));
  const oldByKey = new Map(old.filter((row) => row.problem_number != null).map((row) => [`${row.problem_number}|${row.sub_label || ""}`, row]));
  for (const row of old) db.prepare("DELETE FROM oral_exam_mastery WHERE question_id = ?").run(row.id);
  db.prepare("DELETE FROM oral_exam_questions WHERE book_id = ?").run(bookId);
  const insert = db.prepare(`INSERT INTO oral_exam_questions
    (id, book_id, order_index, problem_number, sub_label, question_kind, speech_text, grading_json, category, prompt, model_answer, created_at, reviewed_at, blocked, source_page)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0, ?)`);
  const newByOldId = new Map();
  // 小問はテンプレートに書いた順（本の掲載順）のまま並べる。文字列で比べると (10) が (2) より前に来てしまうため。
  const fileOrder = new Map(questions.map((q, index) => [q, index]));
  questions.sort((a, b) => a.problemNumber - b.problemNumber || fileOrder.get(a) - fileOrder.get(b));
  questions.forEach((q, orderIndex) => {
    const id = crypto.randomUUID();
    insert.run(id, bookId, orderIndex, q.problemNumber, q.subLabel, q.questionKind, q.speechText, JSON.stringify(q.grading), q.chapter, q.prompt, q.modelAnswer, q.sourcePage);
    const oldRow = oldByKey.get(`${q.problemNumber}|${q.subLabel}`);
    if (oldRow) newByOldId.set(oldRow.id, id);
  });
  const restore = db.prepare(`INSERT INTO oral_exam_mastery
    (student_id, question_id, level, correct_streak, total_attempts, last_result, last_response_time_ms, last_attempt_at, next_review_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let carried = 0;
  for (const row of oldMastery) {
    const newId = newByOldId.get(row.question_id);
    if (!newId) continue;
    restore.run(row.student_id, newId, row.level, row.correct_streak, row.total_attempts, row.last_result, row.last_response_time_ms, row.last_attempt_at, row.next_review_at);
    carried += 1;
  }
  db.exec("COMMIT");
  console.log(`入れ替え完了: ${questions.length}小問 / 習熟度引き継ぎ: ${carried}件 / 回答履歴: 保持`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
