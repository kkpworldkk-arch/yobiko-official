// App Store 審査に出す前に、審査用ゲスト生徒（test.family@example.com / 生徒台帳 s-test-family）の
// 学習記録を空にするCLI。動作確認で解いた市販参考書の問題文が「これまでの記録」に残らないようにする。
// 参考書の割り当て（体験用サンプル問題集のみ）はアプリ側が自動で保つので、ここでは触らない。
//   使い方: node scripts/reset-review-account.mjs
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const REVIEW_STUDENT_ID = "s-test-family";
const REVIEW_EMAIL = "test.family@example.com";

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

const user = db.prepare("SELECT id FROM users WHERE email = ?").get(REVIEW_EMAIL);

db.exec("BEGIN");
let removed = 0;
for (const table of ["oral_exam_attempts", "oral_exam_sessions", "oral_exam_mastery", "oral_exam_insights", "qa_history"]) {
  removed += Number(db.prepare(`DELETE FROM ${table} WHERE student_id = ?`).run(REVIEW_STUDENT_ID).changes);
}
if (user) {
  removed += Number(db.prepare("DELETE FROM student_feedback WHERE user_id = ?").run(user.id).changes);
}
db.exec("COMMIT");

console.log(`審査用ゲスト生徒の学習記録を ${removed} 件削除しました。`);
