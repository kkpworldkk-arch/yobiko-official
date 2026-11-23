// サーバー起動時に一度だけ呼ばれる。DBのバックアップを、起動時と6時間ごと（直近20時間以内にあれば省略）に取る。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { backupDatabaseIfDue } = await import("@/lib/db");
  const run = () => {
    try {
      backupDatabaseIfDue();
    } catch (error) {
      console.error("DBのバックアップに失敗しました", error);
    }
  };
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
