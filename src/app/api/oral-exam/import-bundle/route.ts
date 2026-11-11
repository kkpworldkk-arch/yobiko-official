import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getDataDir } from "@/lib/db";
import { getSession } from "@/lib/session";
import { readTarGz } from "@/lib/tar-gz";

export const dynamic = "force-dynamic";

const FIGURE_PATTERN = /^oral-exam-figures\/[\w-]+\/[\w.-]+\.(?:png|jpg|jpeg|webp)$/i;
const TEMPLATE_PATTERN = /^[\w.-]+\.txt$/;

// 参考書の問題データ（手入力テンプレート）と図をまとめた .tar.gz を受け取り、
// 図を DATA_DIR/oral-exam-figures に置いてから scripts/import-manual-book.mjs で問題を入れ替える。
// Render の Shell や wormhole を使わずに、講師がブラウザから本番へ反映するための入口。
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const bookTitle = String(form?.get("book") ?? "").trim();
  const dryRun = form?.get("dryRun") === "true";
  if (!(file instanceof File) || !bookTitle) {
    return NextResponse.json({ error: "ファイルと参考書を指定してください" }, { status: 400 });
  }

  let entries;
  try {
    entries = readTarGz(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: ".tar.gz として読み込めませんでした" }, { status: 400 });
  }
  const figures = entries.filter((entry) => FIGURE_PATTERN.test(entry.name));
  const templates = entries.filter((entry) => TEMPLATE_PATTERN.test(entry.name));
  if (templates.length !== 1) {
    return NextResponse.json({ error: "問題データ（.txt）がちょうど1つ入っている必要があります" }, { status: 400 });
  }

  const scriptPath = path.join(process.cwd(), "scripts", "import-manual-book.mjs");
  if (!existsSync(scriptPath)) {
    return NextResponse.json({ error: `取り込みスクリプトが見つかりません: ${scriptPath}` }, { status: 500 });
  }

  const dataDir = getDataDir();
  for (const figure of figures) {
    const target = path.join(dataDir, figure.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, figure.data);
  }
  const templatePath = path.join(dataDir, "manual-import", templates[0].name);
  await mkdir(path.dirname(templatePath), { recursive: true });
  await writeFile(templatePath, templates[0].data);

  const args = [scriptPath, templatePath, "--book", bookTitle, ...(dryRun ? ["--dry-run"] : [])];
  const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, DATA_DIR: dataDir } });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("close", (code) => resolve({ code, output }));
    child.on("error", (error) => resolve({ code: 1, output: String(error) }));
  });
  // node:sqlite の試験機能の警告は結果に関係ないので省く
  const log = result.output
    .split("\n")
    .filter((line) => !/ExperimentalWarning|--trace-warnings/.test(line))
    .join("\n")
    .trim();

  return NextResponse.json(
    { ok: result.code === 0, figures: figures.length, log },
    { status: result.code === 0 ? 200 : 500 },
  );
}
