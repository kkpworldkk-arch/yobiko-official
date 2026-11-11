import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { resolveOralExamFigurePath } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// 口頭試問の問題の図を返す。参考書から切り出した画像なので、ログインした人にだけ見せる。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const relative = (await params).path.join("/");
  const filePath = resolveOralExamFigurePath(relative);
  if (!filePath) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const data = await readFile(filePath).catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const extension = relative.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
