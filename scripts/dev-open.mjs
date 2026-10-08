import { spawn } from "node:child_process";
import open, { apps } from "open";

const port = process.env.PORT || "3000";
const url = `http://localhost:${port}/login`;

const child = spawn("next dev", {
  stdio: ["ignore", "pipe", "inherit"],
  shell: true,
});

let launched = false;

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);

  if (!launched && /Ready in/.test(text)) {
    launched = true;
    // シークレットウィンドウで開くことで、残っているログインセッションや
    // 前回開いていたタブの影響を受けずに毎回ログイン画面から確認できる。
    open(url, { app: { name: apps.chrome, arguments: ["--incognito"] } }).catch(() => {
      open(url).catch(() => {
        console.error(`ブラウザを自動で開けませんでした。手動でどうぞ: ${url}`);
      });
    });
  }
});

child.on("exit", (code) => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
