import { NextRequest, NextResponse } from "next/server";
import {
  createOralExamSession,
  ensureOralExamSeeded,
  getOralExamBooks,
  getOralExamReviewPool,
  isBookAssignedToStudent,
  markQuestionReviewed,
} from "@/lib/db";
import { reviewOralExamQuestion } from "@/lib/oral-exam-review";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import type { OralExamQueueItem } from "@/lib/types";
import type { OralExamQuestionFilters } from "@/lib/db";

const QUEUE_SIZE = 10;
const REVIEW_POOL_SIZE = 25;

interface SessionRequestBody {
  bookId?: string;
  filters?: OralExamQuestionFilters;
}

function needsQuestionReview(item: OralExamQueueItem): boolean {
  const { question } = item;
  if (question.reviewedAt) return false;

  const prompt = question.prompt.trim();
  const answer = question.modelAnswer.trim();
  const combined = `${prompt}\n${answer}`;

  // 明らかなOCR崩れや、答えとして成立しない候補だけをClaude点検へ回す。
  if (
    !prompt ||
    !answer ||
    prompt.length < 12 ||
    answer.length > 500 ||
    /�|[\uE000-\uF8FF]/.test(combined) ||
    /記載なし|確認できない|出題不可|判断できない|不明です/.test(combined) ||
    prompt === answer ||
    !/[ぁ-んァ-ン一-龥A-Za-z]/.test(prompt)
  ) {
    return true;
  }

  return /(?:[IlO0]{3,}|[|｜]{2,}|[.,。]{3,}|\s{5,})/.test(combined);
}

async function buildQueue(pool: OralExamQueueItem[]): Promise<OralExamQueueItem[]> {
  const accepted: OralExamQueueItem[] = [];
  const candidates = pool.filter((item) => !needsQuestionReview(item));
  const suspicious = pool.filter((item) => needsQuestionReview(item));

  accepted.push(...candidates.slice(0, QUEUE_SIZE));
  if (accepted.length >= QUEUE_SIZE) return accepted.slice(0, QUEUE_SIZE);

  const reviewed = await Promise.all(
    suspicious.map(async (item) => {
      const question = item.question;
      const result = await reviewOralExamQuestion({
        category: question.category,
        prompt: question.prompt,
        modelAnswer: question.modelAnswer,
      });

      if (result.status === "blocked") {
        markQuestionReviewed(question.id, { blocked: true });
        return null;
      }
      if (result.status === "fixed") {
        markQuestionReviewed(question.id, {
          blocked: false,
          prompt: result.prompt,
          modelAnswer: result.modelAnswer,
        });
        return {
          ...item,
          question: { ...question, prompt: result.prompt, modelAnswer: result.modelAnswer },
        };
      }
      if (result.status === "ok") {
        markQuestionReviewed(question.id, {
          blocked: false,
          prompt: question.prompt,
          modelAnswer: question.modelAnswer,
        });
      }
      return result.status === "error" ? item : item;
    }),
  );

  accepted.push(...reviewed.filter((item): item is OralExamQueueItem => item !== null));
  return accepted.slice(0, QUEUE_SIZE);
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
  const pool = getOralExamReviewPool(studentId, bookId, REVIEW_POOL_SIZE, filters);
  if (pool.length === 0) {
    return NextResponse.json({ error: "指定した条件に一致する問題がありません" }, { status: 404 });
  }

  const examSession = createOralExamSession(studentId, bookId);
  const reviewedItems = await buildQueue(pool);
  const queue = reviewedItems.map((item) => ({
    id: item.question.id,
    category: item.question.category,
    prompt: item.question.prompt,
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
  };
  if (filters.pageStart && filters.pageEnd && filters.pageStart > filters.pageEnd) {
    [filters.pageStart, filters.pageEnd] = [filters.pageEnd, filters.pageStart];
  }
  if (filters.questionStart && filters.questionEnd && filters.questionStart > filters.questionEnd) {
    [filters.questionStart, filters.questionEnd] = [filters.questionEnd, filters.questionStart];
  }
  return filters;
}
