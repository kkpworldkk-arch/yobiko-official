import { NextRequest, NextResponse } from "next/server";
import {
  createOralExamSession,
  DAILY_TEST_BOOK_ID,
  ensureOralExamSeeded,
  getDailyTestSource,
  getOralExamBook,
} from "@/lib/db";
import { questionKind } from "@/lib/oral-exam-mastery";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import type { DailyTestCandidate } from "@/lib/db";

// 1回のデイリーテストで出す最大問題数
const MAX_QUESTIONS = 10;

interface DailyTestSessionBody {
  // random: おまかせ（間違い→時間がかかった→正解の順に最大10問を集め、順番はランダム）
  // select: 生徒が選んだ問題だけ
  mode?: "random" | "select";
  questionIds?: string[];
  studentId?: string;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 間違えた問題・時間がかかった問題を優先し、足りなければ正解した問題を足す。
// 同じ優先度の中ではランダムに選び、出す順番もランダムにする。
function pickByPriority(candidates: DailyTestCandidate[]): DailyTestCandidate[] {
  const picked: DailyTestCandidate[] = [];
  for (const reason of ["incorrect", "slow", "correct"] as const) {
    const group = shuffle(candidates.filter((candidate) => candidate.reason === reason));
    picked.push(...group.slice(0, MAX_QUESTIONS - picked.length));
    if (picked.length >= MAX_QUESTIONS) break;
  }
  return shuffle(picked);
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as DailyTestSessionBody | null;
  const studentId =
    session.role === "family" ? resolveStudentIdentity(session).id : body?.studentId;
  if (!studentId) {
    return NextResponse.json({ error: "studentId は必須です" }, { status: 400 });
  }
  if (body?.mode !== "random" && body?.mode !== "select") {
    return NextResponse.json({ error: "mode が不正です" }, { status: 400 });
  }

  ensureOralExamSeeded();
  const source = getDailyTestSource(studentId);
  if (!source || source.candidates.length === 0) {
    return NextResponse.json(
      { error: "復習できる口頭試問の記録がありません。先に口頭試問に取り組んでください。" },
      { status: 404 },
    );
  }

  let chosen: DailyTestCandidate[];
  if (body.mode === "random") {
    chosen = pickByPriority(source.candidates);
  } else {
    const wanted = new Set(
      Array.isArray(body.questionIds)
        ? body.questionIds.filter((id): id is string => typeof id === "string")
        : [],
    );
    // 画面に出した候補の中からだけ選べる。選んだ順ではなく、出題元の優先順に並べる。
    chosen = source.candidates.filter((candidate) => wanted.has(candidate.item.question.id)).slice(0, MAX_QUESTIONS);
    if (chosen.length === 0) {
      return NextResponse.json({ error: "問題を1問以上選んでください。" }, { status: 400 });
    }
  }

  const examSession = createOralExamSession(studentId, DAILY_TEST_BOOK_ID, "daily");
  const queue = chosen.map(({ item }) => ({
    id: item.question.id,
    problemNumber: item.question.problemNumber,
    subLabel: item.question.subLabel,
    problemType: item.question.problemType,
    speechText: item.question.speechText,
    category: item.question.category,
    prompt: item.question.prompt,
    figures: item.question.figures,
    kind: questionKind(item.question, getOralExamBook(item.question.bookId)?.subject),
    mastery: item.mastery,
  }));

  return NextResponse.json({ session: examSession, queue, source: { day: source.day, isYesterday: source.isYesterday } });
}
