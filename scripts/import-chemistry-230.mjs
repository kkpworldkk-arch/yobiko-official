// 化学230選の手入力テンプレートをDBへ置き換える互換ラッパー。
// 使い方: node scripts/import-chemistry-230.mjs data/manual-import/chemistry-230.txt [--dry-run]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const result = spawnSync(process.execPath, [fileURLToPath(new URL("./import-manual-book.mjs", import.meta.url)), ...process.argv.slice(2), "--book", "化学頻出スタンダード問題230選"], { stdio: "inherit" });
process.exit(result.status ?? 1);
