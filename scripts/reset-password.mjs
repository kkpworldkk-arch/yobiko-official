// 既存ログインアカウントのパスワードを再設定するCLI。
// パスワードはハッシュ化してしか保存していないため、忘れた/分からなくなった場合は
// 覚え直すのではなく、ここで新しいパスワードに置き換える。
// 使い方: node scripts/reset-password.mjs --email=you@example.com --password=xxxxxxxx
//   全アカウントを同じパスワードに一括で揃えたい場合:
//     node scripts/reset-password.mjs --all --password=xxxxxxxx
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync } from "node:crypto";
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
    "使い方: node scripts/reset-password.mjs --email=you@example.com --password=xxxxxxxx",
  );
  console.error(
    "        node scripts/reset-password.mjs --all --password=xxxxxxxx  (全アカウント一括)",
  );
  process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), "data");
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

const args = parseArgs();
const { email, password } = args;

if (!password || password.length < 8) {
  usageAndExit("password は8文字以上で指定してください。");
}
if (!args.all && !email) {
  usageAndExit("--email または --all のいずれかを指定してください。");
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `${salt}:${hash}`;

if (args.all) {
  const users = db.prepare("SELECT id, email, role, name FROM users").all();
  for (const u of users) {
    const s = randomBytes(16).toString("hex");
    const h = scryptSync(password, s, 64).toString("hex");
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(`${s}:${h}`, u.id);
  }
  console.log(`全${users.length}アカウントのパスワードを更新しました。新しいパスワード: ${password}`);
  console.log("");
  for (const u of users) {
    console.log(`  ${u.role === "teacher" ? "講師" : "生徒・保護者"} | ${u.email} | ${u.name}`);
  }
} else {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare("SELECT id, name FROM users WHERE email = ?").get(normalizedEmail);
  if (!user) {
    console.error(`${normalizedEmail} のアカウントが見つかりません。`);
    process.exit(1);
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, user.id);
  console.log(`更新しました: ${user.name} <${normalizedEmail}> の新しいパスワード: ${password}`);
}
