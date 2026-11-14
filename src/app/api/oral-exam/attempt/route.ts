import { NextRequest, NextResponse } from "next/server";
import {
  getOralExamBook,
  getRecentTranscriptionCorrections,
  hasUserAiConsent,
  getOralExamQuestion,
  getOralExamSession,
  getMastery,
  insertOralExamAttempt,
  touchOralExamSession,
  upsertMastery,
} from "@/lib/db";
import { gradeOralExamAnswer } from "@/lib/oral-exam-grading";
import { computeNextMastery, masteryLevelLabel, questionKind, speedLabel } from "@/lib/oral-exam-mastery";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import type { OralExamInputMode } from "@/lib/types";

interface AttemptRequestBody {
  sessionId?: string;
  questionId?: string;
  answerText?: string;
  answerImageDataUrl?: string;
  inputMode?: OralExamInputMode;
  responseTimeMs?: number;
  studentId?: string;
}

export const dynamic = "force-dynamic";

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

  const body = (await request.json().catch(() => null)) as AttemptRequestBody | null;
  const studentId =
    session.role === "family" ? resolveStudentIdentity(session).id : body?.studentId;

  const sessionId = body?.sessionId;
  const questionId = body?.questionId;
  const answerText = body?.answerText?.trim() ?? "";
  const answerImageDataUrl = body?.answerImageDataUrl ?? "";
  const inputMode = body?.inputMode ?? "keyboard";
  const responseTimeMs = Math.max(0, Math.round(body?.responseTimeMs ?? 0));
  const validInputModes: OralExamInputMode[] = ["voice", "handwriting", "keyboard"];

  if (!studentId || !sessionId || !questionId || (!answerText && !answerImageDataUrl)) {
    return NextResponse.json(
      {
        error:
          "studentId, sessionId, questionId と、answerText または answerImageDataUrl のいずれかが必須です",
      },
      { status: 400 },
    );
  }
  if (!validInputModes.includes(inputMode)) {
    return NextResponse.json({ error: "inputMode が不正です" }, { status: 400 });
  }
  if (answerImageDataUrl.length > 4_000_000) {
    return NextResponse.json({ error: "手書き画像が大きすぎます" }, { status: 413 });
  }

  const examSession = getOralExamSession(sessionId);
  const question = getOralExamQuestion(questionId);
  if (
    !examSession ||
    !question ||
    examSession.studentId !== studentId ||
    // デイリーテストは複数の参考書をまたぐので、参考書の一致は確かめない
    (examSession.kind !== "daily" && examSession.bookId !== question.bookId)
  ) {
    return NextResponse.json({ error: "セッションまたは問題が見つかりません" }, { status: 404 });
  }

  const book = getOralExamBook(question.bookId);

  // 手書きのときは、この生徒について過去に直された読み間違いを手がかりとして渡す
  const result = await gradeOralExamAnswer({
    question,
    inputMode,
    answerText,
    answerImageDataUrl,
    hints: answerImageDataUrl ? getRecentTranscriptionCorrections(studentId) : [],
  });
  if (result.status === "ai_failed") {
    return NextResponse.json(
      { error: "AI採点に失敗しました。回答は保存されていません。もう一度お試しください。" },
      { status: 502 },
    );
  }
  const { graded, source } = result;

  const kind = questionKind(question, book?.subject);
  const previousMastery = getMastery(studentId, questionId);
  const nextState = computeNextMastery(
    previousMastery,
    graded.isCorrect ? "correct" : "incorrect",
    responseTimeMs,
    kind,
  );
  upsertMastery({
    studentId,
    questionId,
    ...nextState,
  });

  touchOralExamSession(sessionId, graded.isCorrect);

  const aiTranscription = answerImageDataUrl ? graded.transcription?.trim() ?? "" : "";
  const attempt = insertOralExamAttempt(
    {
      sessionId,
      studentId,
      questionId,
      bookId: question.bookId,
      bookTitle: book?.title ?? "",
      category: question.category,
      questionPrompt: question.prompt,
      problemNumber: question.problemNumber,
      subLabel: question.subLabel,
      inputMode,
      // 手書きのときは、AIが読み取った文字を回答テキストとして残す（講師・生徒が誤読に気づけるように）。
      answerText: answerText || aiTranscription,
      aiTranscription,
      transcriptionCorrected: false,
      answerImageDataUrl,
      responseTimeMs,
      isCorrect: graded.isCorrect,
      evaluation: graded.evaluation,
      strengths: graded.strengths,
      improvements: graded.improvements,
      masteryLevel: nextState.level,
      feedbackSource: source,
    },
    // 読み取りが直されたときに習熟度を採点し直せるよう、更新前の状態を残しておく
    previousMastery,
  );

  return NextResponse.json({
    attempt,
    source,
    mastery: {
      level: nextState.level,
      label: masteryLevelLabel(nextState.level),
      nextReviewAt: nextState.nextReviewAt,
    },
    speed: speedLabel(responseTimeMs, kind),
  });
}
