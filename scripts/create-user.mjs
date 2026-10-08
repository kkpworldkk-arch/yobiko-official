// ログインアカウントを作成するCLI。サインアップ画面がない前提で、講師・生徒/保護者アカウントを
// 運営者が手動で発行するために使う。パスワードのハッシュ方式は src/lib/password.ts と揃えること。
//
// 生徒・保護者アカウント（role=family）は、--student-id または --student-name で
// 生徒台帳（students）の既存レコードと紐付けられる。紐付けると、そのアカウントで
// ログインした本人専用のデータ（質問履歴など）が表示されるようになる。
// 紐付けを省略した場合は、従来通りデモ生徒データが表示される（プレビュー用途）。
import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) args[match[1]] = match[2] ?? "true";
  }
  return args;
}

function usageAndExit(message) {
  if (message) console.error(message);
  console.error(
    '使い方: node scripts/create-user.mjs --email=you@example.com --password=xxxxxxxx --role=teacher --name="氏名"',
  );
  console.error(
    "role=family の場合、--student-id=<id> または --student-name=<生徒台帳の氏名> で生徒を紐付けられます（任意）。",
  );
  console.error(
    "生徒一覧を確認するには: node scripts/create-user.mjs --list-students",
  );
  process.exit(1);
}

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    grade TEXT NOT NULL,
    target_university TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
{
  const columns = db.prepare("PRAGMA table_info(students)").all();
  if (!columns.some((c) => c.name === "user_id")) {
    db.exec("ALTER TABLE students ADD COLUMN user_id TEXT");
  }
}

const args = parseArgs();

if (args["list-students"]) {
  const students = db
    .prepare(
      "SELECT id, name, grade, target_university, user_id FROM students ORDER BY created_at DESC",
    )
    .all();
  if (students.length === 0) {
    console.log("生徒台帳（students）はまだ空です。ダッシュボードの「生徒一覧」から追加してください。");
  } else {
    console.log("生徒台帳一覧:");
    for (const s of students) {
      const linked = s.user_id ? "（ログインアカウント紐付け済み）" : "";
      console.log(`  ${s.id}  ${s.name}（${s.grade}・${s.target_university}）${linked}`);
    }
  }
  process.exit(0);
}

const { email, password, role, name } = args;

if (!email || !password || !role || !name) {
  usageAndExit();
}
if (role !== "teacher" && role !== "family") {
  usageAndExit("role は teacher または family のいずれかを指定してください。");
}
if (password.length < 8) {
  usageAndExit("password は8文字以上にしてください。");
}

const normalizedEmail = email.trim().toLowerCase();

const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(normalizedEmail);

if (existing) {
  console.error(`${normalizedEmail} のアカウントは既に存在します。`);
  process.exit(1);
}

// role=family の場合、生徒台帳との紐付けを先に解決しておく（アカウント作成前に失敗させたい）
let linkedStudentId = null;
if (role === "family") {
  if (args["student-id"]) {
    const student = db
      .prepare("SELECT id, name FROM students WHERE id = ?")
      .get(args["student-id"]);
    if (!student) {
      usageAndExit(`student-id "${args["student-id"]}" に一致する生徒が見つかりません。`);
    }
    linkedStudentId = student.id;
  } else if (args["student-name"]) {
    const matches = db
      .prepare("SELECT id, name, grade, target_university FROM students WHERE name = ?")
      .all(args["student-name"]);
    if (matches.length === 0) {
      usageAndExit(`student-name "${args["student-name"]}" に一致する生徒が見つかりません。--list-students で確認してください。`);
    }
    if (matches.length > 1) {
      console.error(`student-name "${args["student-name"]}" に一致する生徒が複数見つかりました。--student-id で指定してください:`);
      for (const m of matches) {
        console.error(`  ${m.id}  ${m.name}（${m.grade}・${m.target_university}）`);
      }
      process.exit(1);
    }
    linkedStudentId = matches[0].id;
  } else {
    console.warn(
      "警告: 生徒台帳との紐付けが指定されていません。このアカウントはログイン後、デモ生徒のデータを表示します。\n" +
        "      実データを表示するには --student-id または --student-name を指定してください。",
    );
  }
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `${salt}:${hash}`;
const userId = randomUUID();

db.prepare(
  `INSERT INTO users (id, email, password_hash, role, name, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
).run(userId, normalizedEmail, passwordHash, role, name, new Date().toISOString());

if (linkedStudentId) {
  db.prepare("UPDATE students SET user_id = ? WHERE id = ?").run(userId, linkedStudentId);
}

console.log(`作成しました: ${name} <${normalizedEmail}> (${role === "teacher" ? "講師" : "生徒・保護者"})`);
if (linkedStudentId) {
  console.log(`生徒台帳「${args["student-name"] ?? linkedStudentId}」に紐付けました。`);
}
