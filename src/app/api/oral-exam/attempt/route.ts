import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  getOralExamBook,
  getOralExamQuestion,
  getOralExamSession,
  getMastery,
  insertOralExamAttempt,
  touchOralExamSession,
  upsertMastery,
} from "@/lib/db";
import { generateOralExamFeedback } from "@/lib/oral-exam-mock";
import { computeNextMastery, masteryLevelLabel, speedLabel } from "@/lib/oral-exam-mastery";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import type { OralExamInputMode } from "@/lib/types";

const OralExamGradeSchema = z.object({
  isCorrect: z
    .boolean()
    .describe(
      "模範解答の要点を踏まえて正しく答えられていたかどうか。模範解答が与えられていない場合は、質問の意図に対して具体的で一貫した回答であれば true とする",
    ),
  evaluation: z.string().describe("回答全体への総評を2〜3文で、温かい言葉遣いで示す"),
  strengths: z.array(z.string()).describe("回答の良かった点を1〜3個、具体的に示す"),
  improvements: z
    .array(z.string())
    .describe("回答をより良くするための改善点を1〜3個、実行可能な形で示す"),
});

const SYSTEM_PROMPT = `あなたは個別指導塾「滝原塾」で、生徒が参考書を1冊極めるための口頭試問（一問一答形式のドリル）を採点するAIです。
生徒がその場で即座に、無意識レベルで正しく答えられるようになることを目標にしています。

方針:
- 模範解答が与えられている場合は、その要点を回答が満たしているかどうかで isCorrect を判定してください。表現の違いは許容し、要点が伝わっていれば正解としてください。
- 模範解答が与えられていない場合は、質問の意図に対して具体的で一貫した回答ができていれば正解としてください。
- 回答が手書き画像として与えられる場合は、その内容を読み取ったうえで評価してください。
- 改善点は精神論ではなく、次回すぐに実行できる具体的な言い回し・覚え方の改善を提案してください。
- 丁寧で温かみのある言葉遣いを保ちながら、判定基準は甘くしすぎないでください。`;

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
    examSession.bookId !== question.bookId
  ) {
    return NextResponse.json({ error: "セッションまたは問題が見つかりません" }, { status: 404 });
  }

  const book = getOralExamBook(question.bookId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const aiConfigured = Boolean(apiKey);
  let graded: {
    isCorrect: boolean;
    evaluation: string;
    strengths: string[];
    improvements: string[];
  } | null = null;
  let source: "claude" | "demo" = "demo";
  let aiError = false;

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const contextLines = [
        question.category && `カテゴリ: ${question.category}`,
        `質問: ${question.prompt}`,
        question.modelAnswer && `模範解答（要点）:\n${question.modelAnswer}`,
        `回答形式: ${
          inputMode === "voice"
            ? "音声入力（文字起こし）"
            : inputMode === "handwriting"
              ? "手書き"
              : "キーボード入力"
        }`,
        answerText && `生徒の回答:\n${answerText}`,
        answerImageDataUrl && !answerText && "生徒の回答は添付の手書き画像を参照してください。",
      ].filter(Boolean) as string[];

      const userContent: Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            source: {
              type: "base64";
              media_type: "image/png" | "image/jpeg" | "image/webp";
              data: string;
            };
          }
      > = [{ type: "text", text: contextLines.join("\n") }];

      const imageMatch = answerImageDataUrl
        ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(answerImageDataUrl)
        : null;
      if (imageMatch) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: imageMatch[1] as "image/png" | "image/jpeg" | "image/webp",
            data: imageMatch[2],
          },
        });
      }

      // 採点は模範解答との照合が中心の定型タスクのため、Opus + 拡張思考 + 高effortは
      // 過剰品質だった(体感速度の遅さの主因)。Sonnetに変更し、さらにeffortをlowにして
      // 内部の思考量を減らし速度を優先する。
      const message = await client.messages.parse({
        model: "claude-sonnet-5",
        max_tokens: 768,
        output_config: {
          format: zodOutputFormat(OralExamGradeSchema),
          effort: "low",
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      });

      if (message.parsed_output) {
        graded = message.parsed_output;
        source = "claude";
      }
    } catch (error) {
      aiError = true;
      console.error("Claude API error in /api/oral-exam/attempt:", error);
    }
  }

  if (!graded) {
    if (aiConfigured && aiError) {
      return NextResponse.json(
        { error: "AI採点に失敗しました。回答は保存されていません。もう一度お試しください。" },
        { status: 502 },
      );
    }
    const mock = generateOralExamFeedback({
      question: question.prompt,
      answerText,
      modelAnswer: question.modelAnswer,
    });
    graded = mock;
  }

  const previousMastery = getMastery(studentId, questionId);
  const nextState = computeNextMastery(
    previousMastery,
    graded.isCorrect ? "correct" : "incorrect",
    responseTimeMs,
  );
  upsertMastery({
    studentId,
    questionId,
    ...nextState,
  });

  touchOralExamSession(sessionId, graded.isCorrect);

  const attempt = insertOralExamAttempt({
    sessionId,
    studentId,
    questionId,
    bookId: question.bookId,
    bookTitle: book?.title ?? "",
    category: question.category,
    questionPrompt: question.prompt,
    inputMode,
    answerText,
    answerImageDataUrl,
    responseTimeMs,
    isCorrect: graded.isCorrect,
    evaluation: graded.evaluation,
    strengths: graded.strengths,
    improvements: graded.improvements,
    masteryLevel: nextState.level,
    feedbackSource: source,
  });

  return NextResponse.json({
    attempt,
    source,
    mastery: {
      level: nextState.level,
      label: masteryLevelLabel(nextState.level),
      nextReviewAt: nextState.nextReviewAt,
    },
    speed: speedLabel(responseTimeMs),
  });
}
