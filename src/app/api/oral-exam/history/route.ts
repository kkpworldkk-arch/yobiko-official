import { NextRequest, NextResponse } from "next/server";
import {
  getOralExamAttempts,
  getOralExamSessionsForStudent,
  updateOralExamAttemptComment,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  const bookId = request.nextUrl.searchParams.get("bookId") ?? undefined;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  return NextResponse.json({
    sessions: getOralExamSessionsForStudent(studentId),
    attempts: getOralExamAttempts(studentId, { bookId, limit }),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "teacher") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: string; comment?: string }
    | null;
  if (!body?.id) {
    return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  }

  updateOralExamAttemptComment(body.id, body.comment?.trim() ?? "");
  return NextResponse.json({ ok: true });
}
