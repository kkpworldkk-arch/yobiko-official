// 誤って参考書の問題を入れ替えたとき、バックアップDBにあった習熟度を、現在のDBの同じ問題に書き戻す。
// 使い方: node scripts/restore-mastery-from-backup.mjs <バックアップDBのパス> --book "参考書名" [--dry-run]
// 問題は「章|種類|問題番号|小問番号」で対応づける。現在のDBにすでに習熟度がある（生徒×問題）ものは上書きしない。
import { copyFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const args = process.argv.slice(2);
const backupPath = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--book");
const bookIndex = args.indexOf("--book");
const bookTitle = bookIndex >= 0 ? args[bookIndex + 1] : "";
const dryRun = args.includes("--dry-run");
if (!backupPath || !bookTitle) throw new Error("バックアップDBのパスと --book 参考書名を指定してください。");
if (!existsSync(backupPath)) throw new Error(`バックアップDBがありません: ${backupPath}`);

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "app.db");
if (!existsSync(dbPath)) throw new Error(`DBがありません: ${dbPath}`);

const backup = new DatabaseSync(backupPath, { readOnly: true });
const db = new DatabaseSync(dbPath);
const findBook = (conn) => conn.prepare("SELECT id FROM oral_exam_books WHERE title = ?").get(bookTitle);
const oldBook = findBook(backup);
const newBook = findBook(db);
if (!oldBook) throw new Error(`バックアップに参考書が見つかりません: ${bookTitle}`);
if (!newBook) throw new Error(`現在のDBに参考書が見つかりません: ${bookTitle}`);

const keyOf = (r) => `${r.category}|${r.problem_type || ""}|${r.problem_number}|${r.sub_label || ""}`;
const questionsOf = (conn, bookId) =>
  conn.prepare("SELECT id, category, problem_type, problem_number, sub_label FROM oral_exam_questions WHERE book_id = ?").all(bookId);
const newByKey = new Map(questionsOf(db, newBook.id).map((r) => [keyOf(r), r.id]));
const oldQuestions = questionsOf(backup, oldBook.id);
console.log(`バックアップの問題: ${oldQuestions.length}問 / 現在の問題: ${newByKey.size}問`);

const exists = db.prepare("SELECT 1 FROM oral_exam_mastery WHERE student_id = ? AND question_id = ?");
const insert = db.prepare(
  "INSERT INTO oral_exam_mastery (student_id, question_id, level, correct_streak, total_attempts, last_result, last_response_time_ms, last_attempt_at, next_review_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
const readMastery = backup.prepare("SELECT * FROM oral_exam_mastery WHERE question_id = ?");

let restored = 0;
let skippedExisting = 0;
let unmatched = 0;
const plan = [];
for (const q of oldQuestions) {
  const rows = readMastery.all(q.id);
  if (rows.length === 0) continue;
  const newId = newByKey.get(keyOf(q));
  if (!newId) {
    unmatched += rows.length;
    continue;
  }
  for (const row of rows) {
    if (exists.get(row.student_id, newId)) {
      skippedExisting++;
      continue;
    }
    plan.push([row, newId]);
  }
}
console.log(`書き戻す習熟度: ${plan.length}件 / すでにあるので残す: ${skippedExisting}件 / 対応する問題が無い: ${unmatched}件`);
if (dryRun) {
  console.log("（--dry-run のため書き込みません）");
} else if (plan.length > 0) {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  const safety = path.join(dataDir, `app.db.bak-${stamp}`);
  copyFileSync(dbPath, safety);
  console.log(`バックアップ: ${safety}`);
  db.exec("BEGIN");
  try {
    for (const [row, newId] of plan) {
      insert.run(row.student_id, newId, row.level, row.correct_streak, row.total_attempts, row.last_result, row.last_response_time_ms, row.last_attempt_at, row.next_review_at);
      restored++;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(`書き戻し完了: ${restored}件`);
}
