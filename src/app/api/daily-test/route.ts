import { NextRequest, NextResponse } from "next/server";
import { ensureOralExamSeeded, getDailyTestSource } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export const dynamic = "force-dynamic";

// デイリーテストの出題元（前日、無ければ直近に取り組んだ口頭試問の問題）を一覧で返す。
// 生徒が「どの問題を復習するか」を選ぶ画面で使う。
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const studentId =
    session.role === "family"
      ? resolveStudentIdentity(session).id
      : request.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "studentId は必須です" }, { status: 400 });
  }

  ensureOralExamSeeded();
  const source = getDailyTestSource(studentId);
  if (!source || source.candidates.length === 0) {
    return NextResponse.json({ source: null });
  }

  return NextResponse.json({
    source: {
      day: source.day,
      isYesterday: source.isYesterday,
      candidates: source.candidates.map(({ item, bookTitle, reason }) => ({
        id: item.question.id,
        bookTitle,
        category: item.question.category,
        problemNumber: item.question.problemNumber,
        subLabel: item.question.subLabel,
        problemType: item.question.problemType,
        prompt: item.question.prompt,
        reason,
      })),
    },
  });
}
