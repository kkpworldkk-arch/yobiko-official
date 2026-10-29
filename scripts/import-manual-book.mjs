// 手動入力テンプレートを参考書ごとにDBへ置き換える。
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("--"));
const bookArg = args.find((arg) => arg === "--book");
const bookTitle = bookArg ? args[args.indexOf(bookArg) + 1] : "";
const dryRun = args.includes("--dry-run");
if (!inputPath || !bookTitle) throw new Error("入力ファイルと --book 参考書名を指定してください。");
const chemistryMode = bookTitle === "化学頻出スタンダード問題230選";
const list = (v) => v ? v.split("/").map((x) => x.trim()).filter(Boolean) : [];
const integer = (v, line, label) => { const n = Number(v); if (!Number.isInteger(n)) throw new Error(`${line}行目: ${label} は整数で指定してください。`); return n; };

function parseTemplate(text) {
  const blocks = []; let block = [];
  const flush = () => { if (block.some((x) => x.value.trim())) blocks.push(block); block = []; };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === "---") return flush();
    if (!raw.trim() || raw.trim().startsWith("#")) return;
    const m = /^([A-Z]+):\s?(.*)$/.exec(raw);
    if (!m) { const prev = block.at(-1); if (!prev || !["Q", "R", "A"].includes(prev.key)) throw new Error(`${line}行目: 項目名がありません。`); prev.value += `\n${raw}`; return; }
    block.push({ key: m[1], value: m[2], line });
  });
  flush();
  const seen = new Set();
  const hasType = blocks.some((entries) => entries.some((entry) => entry.key === "TYPE"));
  return blocks.map((entries) => {
    const f = new Map(); for (const e of entries) { if (f.has(e.key)) throw new Error(`${e.line}行目: ${e.key} が重複しています。`); f.set(e.key, e); }
    for (const key of ["C", ...(hasType ? ["TYPE"] : []), "N", "P", "AP", "T", "Q", "A"]) if (!f.get(key)?.value.trim()) throw new Error(`${f.get("N")?.line ?? entries[0].line}行目付近: ${key} がありません。`);
    const n = integer(f.get("N").value.trim(), f.get("N").line, "N"); if (n < 1) throw new Error(`${f.get("N").line}行目: N は1以上です。`); if (chemistryMode && n > 230) throw new Error(`${f.get("N").line}行目: 化学230選のNは230以下です。`);
    const t = f.get("T").value.trim(); if (!["recall", "solve"].includes(t)) throw new Error(`${f.get("T").line}行目: T は recall または solve です。`);
    const type = f.get("TYPE")?.value.trim() ?? ""; if (hasType && !["プロセス", "基本例題", "基本問題", "標準例題", "標準問題", "演習問題"].includes(type)) throw new Error(`${f.get("TYPE").line}行目: TYPE が不正です。`);
    const chapter = f.get("C").value.trim(); const sub = f.get("S")?.value.trim() ?? ""; const key = `${chapter}|${type}|${n}|${sub}`;
    if (seen.has(key)) throw new Error(`${f.get("N").line}行目: C/TYPE/N/S が重複しています (${key})。`); seen.add(key);
    const numericAnswer = f.get("U")?.value.trim() ?? ""; if (t === "solve" && /[0-9０-９]/.test(f.get("Q").value) && !numericAnswer) throw new Error(`${f.get("T").line}行目: 計算問題の solve には U が必要です。`);
    const sig = f.get("SIG")?.value.trim() ?? "";
    return { chapter, type, problemNumber: n, subLabel: sub, sourcePage: integer(f.get("P").value.trim(), f.get("P").line, "P"), answerPage: integer(f.get("AP").value.trim(), f.get("AP").line, "AP"), questionKind: t, prompt: f.get("Q").value.trim(), speechText: f.get("R")?.value.trim() ?? "", modelAnswer: f.get("A").value.trim(), grading: { requiredKeywords: list(f.get("K")?.value.trim()), acceptedVariants: list(f.get("OK")?.value.trim()), misconceptions: list(f.get("NG")?.value.trim()), numericAnswer, significantFigures: sig ? integer(sig, f.get("SIG").line, "SIG") : null } };
  });
}

const questions = parseTemplate(readFileSync(inputPath, "utf8")); if (!questions.length) throw new Error("取り込める問題がありません。");
const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data")); const dbPath = path.join(dataDir, "app.db"); if (!existsSync(dbPath)) throw new Error(`DBがありません: ${dbPath}`);
const db = new DatabaseSync(dbPath); const book = db.prepare("SELECT id FROM oral_exam_books WHERE title = ?").get(bookTitle); if (!book) throw new Error(`参考書台帳が見つかりません: ${bookTitle}`);
const old = db.prepare("SELECT * FROM oral_exam_questions WHERE book_id = ? ORDER BY order_index").all(book.id); const oldMastery = old.flatMap((row) => db.prepare("SELECT * FROM oral_exam_mastery WHERE question_id = ?").all(row.id));
console.log(`新データ: ${questions.length}小問 / 旧データ: ${old.length}問`); if (dryRun) process.exit(0);
mkdirSync(dataDir, { recursive: true }); const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14); const backup = path.join(dataDir, `app.db.bak-${stamp}`); copyFileSync(dbPath, backup); console.log(`バックアップ: ${backup}`);
db.exec("BEGIN IMMEDIATE");
try {
  for (const definition of ["problem_number INTEGER", "sub_label TEXT NOT NULL DEFAULT ''", "problem_type TEXT NOT NULL DEFAULT ''", "question_kind TEXT NOT NULL DEFAULT ''", "speech_text TEXT NOT NULL DEFAULT ''", "grading_json TEXT NOT NULL DEFAULT ''"]) { try { db.exec(`ALTER TABLE oral_exam_questions ADD COLUMN ${definition}`); } catch (e) { if (!String(e).includes("duplicate column")) throw e; } }
  const oldByKey = new Map(old.filter((r) => r.problem_number != null).map((r) => [`${r.category}|${r.problem_type || ""}|${r.problem_number}|${r.sub_label || ""}`, r]));
  const oldMasteryByQuestion = new Map(old.map((r) => [r.id, db.prepare("SELECT * FROM oral_exam_mastery WHERE question_id = ?").all(r.id)]));
  for (const row of old) db.prepare("DELETE FROM oral_exam_mastery WHERE question_id = ?").run(row.id);
  db.prepare("DELETE FROM oral_exam_questions WHERE book_id = ?").run(book.id);
  const insert = db.prepare(`INSERT INTO oral_exam_questions (id, book_id, order_index, problem_number, sub_label, problem_type, question_kind, speech_text, grading_json, category, prompt, model_answer, created_at, reviewed_at, blocked, source_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0, ?)`);
  const newIds = new Map(); questions.forEach((q, i) => { const id = crypto.randomUUID(); insert.run(id, book.id, i, q.problemNumber, q.subLabel, q.type, q.questionKind, q.speechText, JSON.stringify(q.grading), q.chapter, q.prompt, q.modelAnswer, q.sourcePage); const oldRow = oldByKey.get(`${q.chapter}|${q.type}|${q.problemNumber}|${q.subLabel}`); if (oldRow) newIds.set(oldRow.id, id); });
  const restore = db.prepare("INSERT INTO oral_exam_mastery (student_id, question_id, level, correct_streak, total_attempts, last_result, last_response_time_ms, last_attempt_at, next_review_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"); let carried = 0;
  for (const [oldId, rows] of oldMasteryByQuestion) { const id = newIds.get(oldId); if (!id) continue; for (const row of rows) { restore.run(row.student_id, id, row.level, row.correct_streak, row.total_attempts, row.last_result, row.last_response_time_ms, row.last_attempt_at, row.next_review_at); carried++; } }
  db.exec("COMMIT"); console.log(`入れ替え完了: ${questions.length}小問 / 習熟度引き継ぎ: ${carried}件`);
} catch (e) { db.exec("ROLLBACK"); throw e; }
