import { NextRequest, NextResponse } from "next/server";
import { getOralExamQuestion, insertStudentFeedback, markQuestionReviewed } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export const dynamic = "force-dynamic";

// 生徒が口頭試問の最中に「この問題はおかしい」と報告するためのエンドポイント。
// 報告されたら即座に出題対象から外し(blocked)、講師設定画面の一覧にも表示する。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { id } = await params;
  const question = getOralExamQuestion(id);
  if (!question) {
    return NextResponse.json({ error: "問題が見つかりません" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { comment?: string } | null;
  const comment = body?.comment?.trim() ?? "";

  const identity = resolveStudentIdentity(session);
  const label = `${question.category} ｜ ${question.prompt}`.slice(0, 200);
  const message = comment
    ? `【問題の指摘】${label}\n模範解答: ${question.modelAnswer}\n\nコメント: ${comment}`
    : `【問題の指摘】${label}\n模範解答: ${question.modelAnswer}`;

  markQuestionReviewed(id, { blocked: true });
  const feedback = insertStudentFeedback({
    userId: session.userId,
    studentName: identity.name,
    message,
    questionId: id,
    questionLabel: label,
  });

  return NextResponse.json({ feedback });
}
