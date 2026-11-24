import { NextRequest, NextResponse } from "next/server";
import {
  createOralExamSession,
  ensureOralExamSeeded,
  getOralExamBooks,
  getOralExamReviewPool,
  isBookAssignedToStudent,
} from "@/lib/db";
import { questionKind } from "@/lib/oral-exam-mastery";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import type { OralExamQuestionFilters, OralExamQuestionOrder } from "@/lib/db";

interface SessionRequestBody {
  bookId?: string;
  filters?: OralExamQuestionFilters;
  order?: OralExamQuestionOrder;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SessionRequestBody | null;
  const bookId = body?.bookId;
  if (!bookId) {
    return NextResponse.json({ error: "bookId は必須です" }, { status: 400 });
  }

  const studentId =
    session.role === "family"
      ? resolveStudentIdentity(session).id
      : (body as { studentId?: string })?.studentId;
  if (!studentId) {
    return NextResponse.json({ error: "studentId は必須です" }, { status: 400 });
  }

  ensureOralExamSeeded();

  const book = getOralExamBooks().find((b) => b.id === bookId);
  if (!book) {
    return NextResponse.json(
      { error: "参考書が見つかりません" },
      { status: 404 },
    );
  }
  if (book.questionCount === 0) {
    return NextResponse.json(
      { error: "この参考書にはまだ口頭試問の問題が登録されていません" },
      { status: 409 },
    );
  }
  if (!isBookAssignedToStudent(studentId, bookId)) {
    return NextResponse.json(
      { error: "この参考書はまだ割り当てられていません" },
      { status: 403 },
    );
  }

  const filters = normalizeFilters(body?.filters);
  const order: OralExamQuestionOrder = body?.order === "sequential" ? "sequential" : "random";
  const pool = getOralExamReviewPool(studentId, bookId, Number.MAX_SAFE_INTEGER, filters, order);
  if (pool.length === 0) {
    return NextResponse.json({ error: "指定した条件に一致する問題がありません" }, { status: 404 });
  }

  const examSession = createOralExamSession(studentId, bookId);
  const queue = pool.map((item) => ({
    id: item.question.id,
    problemNumber: item.question.problemNumber,
    subLabel: item.question.subLabel,
    problemType: item.question.problemType,
    speechText: item.question.speechText,
    category: item.question.category,
    prompt: item.question.prompt,
    figures: item.question.figures,
    kind: questionKind(item.question, book.subject),
    mastery: item.mastery,
  }));

  return NextResponse.json({ session: examSession, queue });
}

function normalizeFilters(input: OralExamQuestionFilters | undefined): OralExamQuestionFilters {
  const positiveInteger = (value: unknown): number | undefined => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return undefined;
    return value;
  };
  const filters: OralExamQuestionFilters = {
    pageStart: positiveInteger(input?.pageStart),
    pageEnd: positiveInteger(input?.pageEnd),
    questionStart: positiveInteger(input?.questionStart),
    questionEnd: positiveInteger(input?.questionEnd),
    chapters: Array.isArray(input?.chapters)
      ? input.chapters
          .filter((chapter): chapter is string => typeof chapter === "string")
          .map((chapter) => chapter.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 500)
      : undefined,
    problemTypes: Array.isArray(input?.problemTypes)
      ? input.problemTypes
          .filter((type): type is string => typeof type === "string")
          .map((type) => type.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 50)
      : undefined,
    problemType: typeof input?.problemType === "string" ? input.problemType.trim().slice(0, 100) || undefined : undefined,
  };
  if (filters.pageStart && filters.pageEnd && filters.pageStart > filters.pageEnd) {
    [filters.pageStart, filters.pageEnd] = [filters.pageEnd, filters.pageStart];
  }
  if (filters.questionStart && filters.questionEnd && filters.questionStart > filters.questionEnd) {
    [filters.questionStart, filters.questionEnd] = [filters.questionEnd, filters.questionStart];
  }
  return filters;
}
