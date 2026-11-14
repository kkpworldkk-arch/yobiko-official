import { NextRequest, NextResponse } from "next/server";
import {
  adjustSessionCorrectCount,
  applyAttemptCorrection,
  getMastery,
  getOralExamAttempt,
  getOralExamBook,
  getOralExamQuestion,
  hasUserAiConsent,
  upsertMastery,
} from "@/lib/db";
import { gradeOralExamAnswer } from "@/lib/oral-exam-grading";
import { computeNextMastery, masteryLevelLabel, questionKind } from "@/lib/oral-exam-mastery";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export const dynamic = "force-dynamic";

// 手書きの読み取りをAIが間違えたとき、生徒（または講師）が正しい文字に直す。
// 直した文字で採点をやり直し、AIの最初の読み取りと直した文字の組を、次回以降の読み取りの手がかりとして残す。
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (session.role === "family" && !hasUserAiConsent(session.userId)) {
    return NextResponse.json(
      { error: "AI機能を使うには、AIへのデータ送信への同意が必要です。" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { attemptId?: string; correctedText?: string } | null;
  const correctedText = body?.correctedText?.trim().slice(0, 2000) ?? "";
  if (!body?.attemptId || !correctedText) {
    return NextResponse.json({ error: "attemptId と correctedText は必須です" }, { status: 400 });
  }

  const found = getOralExamAttempt(body.attemptId);
  if (!found || found.attempt.inputMode !== "handwriting") {
    return NextResponse.json({ error: "手書きの回答が見つかりません" }, { status: 404 });
  }
  const { attempt, previousMastery, hasPreviousState } = found;
  if (session.role === "family" && attempt.studentId !== resolveStudentIdentity(session).id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const question = getOralExamQuestion(attempt.questionId);
  if (!question) {
    return NextResponse.json({ error: "問題が見つかりません" }, { status: 404 });
  }

  const result = await gradeOralExamAnswer({
    question,
    inputMode: "handwriting",
    answerText: correctedText,
    answerImageDataUrl: "",
  });
  if (result.status === "ai_failed") {
    return NextResponse.json({ error: "AI採点に失敗しました。もう一度お試しください。" }, { status: 502 });
  }
  const { graded, source } = result;

  // 採点が変わったら習熟度も計算し直す。ただし、その後に同じ問題へ答えていて状態が進んでいる場合や、
  // 回答前の状態を記録していない古い回答は、習熟度には手を付けない。
  let masteryLevel = attempt.masteryLevel;
  const current = getMastery(attempt.studentId, attempt.questionId);
  const isLatest = (current?.totalAttempts ?? 0) === (previousMastery?.totalAttempts ?? 0) + 1;
  if (graded.isCorrect !== attempt.isCorrect && hasPreviousState && isLatest) {
    const book = getOralExamBook(question.bookId);
    const next = computeNextMastery(
      previousMastery,
      graded.isCorrect ? "correct" : "incorrect",
      attempt.responseTimeMs,
      questionKind(question, book?.subject),
    );
    upsertMastery({ studentId: attempt.studentId, questionId: attempt.questionId, ...next });
    masteryLevel = next.level;
    adjustSessionCorrectCount(attempt.sessionId, graded.isCorrect ? 1 : -1);
  }

  const corrected = {
    answerText: correctedText,
    isCorrect: graded.isCorrect,
    evaluation: graded.evaluation,
    strengths: graded.strengths,
    improvements: graded.improvements,
    masteryLevel,
    feedbackSource: source,
  };
  applyAttemptCorrection(attempt.id, corrected);

  const latest = getMastery(attempt.studentId, attempt.questionId);
  return NextResponse.json({
    attempt: { ...attempt, ...corrected, transcriptionCorrected: true },
    source,
    mastery: {
      level: masteryLevel,
      label: masteryLevelLabel(masteryLevel),
      nextReviewAt: latest?.nextReviewAt ?? null,
    },
  });
}
