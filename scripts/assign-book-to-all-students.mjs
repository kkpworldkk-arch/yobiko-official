// 参考書を全生徒に割り当てる（すでに割り当て済みの生徒はそのまま）。
// 使い方: node scripts/assign-book-to-all-students.mjs --book "参考書名" [--dry-run]
// App Store 審査用のゲスト生徒（s-test-family）には割り当てない。
import { copyFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import crypto from "node:crypto";

const REVIEW_STUDENT_ID = "s-test-family";
const args = process.argv.slice(2);
const bookIndex = args.indexOf("--book");
const bookTitle = bookIndex >= 0 ? args[bookIndex + 1] : "";
const dryRun = args.includes("--dry-run");
if (!bookTitle) throw new Error("--book 参考書名を指定してください。");

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "app.db");
if (!existsSync(dbPath)) throw new Error(`DBがありません: ${dbPath}`);
const db = new DatabaseSync(dbPath);

const book = db.prepare("SELECT id FROM oral_exam_books WHERE title = ?").get(bookTitle);
if (!book) throw new Error(`参考書が見つかりません: ${bookTitle}`);
const questionCount = db.prepare("SELECT COUNT(*) c FROM oral_exam_questions WHERE book_id = ?").get(book.id).c;
if (questionCount === 0) throw new Error(`この参考書にはまだ問題が入っていません: ${bookTitle}`);

const students = db.prepare("SELECT id FROM students WHERE id <> ?").all(REVIEW_STUDENT_ID);
const assigned = new Set(
  db.prepare("SELECT student_id FROM oral_exam_assignments WHERE book_id = ?").all(book.id).map((r) => r.student_id),
);
const targets = students.filter((s) => !assigned.has(s.id));
console.log(`参考書: ${bookTitle}（${questionCount}小問） / 生徒: ${students.length}人 / 割り当て済み: ${students.length - targets.length}人 / 今回の割り当て: ${targets.length}人`);

if (dryRun) {
  console.log("（--dry-run のため書き込みません）");
} else if (targets.length > 0) {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  const safety = path.join(dataDir, `app.db.bak-${stamp}`);
  copyFileSync(dbPath, safety);
  console.log(`バックアップ: ${safety}`);
  const insert = db.prepare("INSERT INTO oral_exam_assignments (id, student_id, book_id, assigned_at) VALUES (?, ?, ?, ?)");
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const s of targets) insert.run(crypto.randomUUID(), s.id, book.id, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(`割り当て完了: ${targets.length}人`);
}
