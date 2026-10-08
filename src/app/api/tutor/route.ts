import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getQaHistory, insertQaHistory, resolveTeacherCheck } from "@/lib/db";
import { generateTutorResponse } from "@/lib/ai-tutor-mock";
import { buildPersonalizationContext } from "@/lib/personalization";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";
import type {
  AnswerStatus,
  Attachment,
  Confidence,
  Difficulty,
  InputType,
  QuestionFormat,
  QuestionMeta,
  TutorResponse,
} from "@/lib/types";

const TutorResponseSchema = z.object({
  summary: z
    .string()
    .describe("生徒の質問を要約し、どこから考えるべきかを1〜2文で示す"),
  steps: z
    .array(z.string())
    .describe("解法・理解の手順を3〜5ステップで、実行可能な形で示す"),
  weaknessTag: z
    .string()
    .describe("「単元名-つまずきの種類」の形式のタグ（例: 確率-条件整理）"),
  reviewSuggestion: z
    .string()
    .describe("担当講師と共有する前提で、今後の復習方法を1〜2文で具体的に提案する"),
});

const SYSTEM_PROMPT = `あなたは医学部受験専門の個別指導塾「滝原塾」の専属AIチューターです。
医学部合格を目指す生徒からの教科質問に、経験豊富な個別指導講師のように丁寧に対応してください。

方針:
- 答えをすぐに教えるのではなく、生徒が自力で解けるようになる考え方の道筋を示してください。
- 教科（数学・英語・化学・生物・物理）と単元に応じた専門的で正確な解説をしてください。
- 質問文に含まれる具体的な数式・条件・単語を踏まえて回答してください。一般論で済ませないでください。
- 生徒自身の解答状況・確信度・考えたことが与えられている場合は、それを踏まえて回答の深さを調整してください。
- 丁寧で温かみのある言葉遣いを保ちながら、学術的な正確さを最優先してください。
- steps は生徒がその場で実行できる具体的な手順にしてください（「頑張りましょう」等の精神論は禁止）。
- weaknessTag は必ず「単元名-つまずきの種類」の形式で1つだけ出力してください。生徒が弱点タグの候補を示している場合は、それを参考にしつつ質問内容に最も合うものを選んでください。
- reviewSuggestion は担当講師が読む前提で、今後48時間以内に取るべき具体的な復習行動を提案してください。
- 「この生徒のこれまでの傾向」が示されている場合は、それを踏まえて回答を個別最適化してください。同じ弱点タグが繰り返し出ている場合はそのことに触れ、これまでと同じ説明の繰り返しではなく、違う角度からのアプローチを提案してください。傾向情報がない場合（初めての質問）は通常通り対応してください。`;

interface TutorRequestBody {
  studentId?: string;
  subject?: string;
  unit?: string;
  question?: string;
  university?: string;
  year?: string;
  difficulty?: Difficulty;
  format?: QuestionFormat;
  inputType?: InputType;
  studentAttempt?: string;
  answerStatus?: AnswerStatus;
  confidence?: Confidence;
  weaknessHint?: string;
  teacherCheckNeeded?: boolean;
  attachments?: Attachment[];
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // familyロールは自分に紐付いた生徒以外のstudentIdを指定できない（URLパラメータは無視する）
  const studentId =
    session.role === "family"
      ? resolveStudentIdentity(session).id
      : request.nextUrl.searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json(
      { error: "studentId is required" },
      { status: 400 },
    );
  }
  return NextResponse.json({ history: getQaHistory(studentId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as TutorRequestBody | null;
  // familyロールは自分に紐付いた生徒以外のstudentIdを指定できない（リクエストボディの値は無視する）
  const studentId =
    session.role === "family" ? resolveStudentIdentity(session).id : body?.studentId;
  const subject = body?.subject;
  const unit = body?.unit?.trim() ?? "";
  const question = body?.question?.trim() ?? "";

  if (!studentId || !subject || !question) {
    return NextResponse.json(
      { error: "studentId, subject, question は必須です" },
      { status: 400 },
    );
  }

  const meta: QuestionMeta = {
    university: body?.university?.trim() ?? "",
    year: body?.year?.trim() ?? "",
    difficulty: body?.difficulty ?? "標準",
    format: body?.format ?? "普段の問題",
    inputType: body?.inputType ?? "テキスト",
    studentAttempt: body?.studentAttempt?.trim() ?? "",
    answerStatus: body?.answerStatus ?? "未着手",
    confidence: body?.confidence ?? "中",
    weaknessHint: body?.weaknessHint?.trim() ?? "",
    teacherCheckNeeded: body?.teacherCheckNeeded ?? false,
  };
  const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let tutorResponse: TutorResponse | null = null;
  let source: "claude" | "demo" = "demo";

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const personalizationContext = buildPersonalizationContext(studentId);
      const contextLines = [
        `教科: ${subject}`,
        `単元: ${unit || "指定なし"}`,
        meta.university && `志望大学: ${meta.university}`,
        meta.difficulty && `難度: ${meta.difficulty}`,
        meta.answerStatus && `解答状況: ${meta.answerStatus}`,
        meta.confidence && `確信度: ${meta.confidence}`,
        meta.studentAttempt && `生徒が考えたこと: ${meta.studentAttempt}`,
        meta.weaknessHint && `生徒が挙げた弱点タグ候補: ${meta.weaknessHint}`,
        personalizationContext &&
          `この生徒のこれまでの傾向:\n${personalizationContext}`,
        `質問内容:\n${question}`,
      ].filter(Boolean);

      const message = await client.messages.parse({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: {
          format: zodOutputFormat(TutorResponseSchema),
          effort: "high",
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contextLines.join("\n") }],
      });

      if (message.parsed_output) {
        tutorResponse = message.parsed_output;
        source = "claude";
      }
    } catch (error) {
      console.error("Claude API error in /api/tutor:", error);
    }
  }

  if (!tutorResponse) {
    tutorResponse = generateTutorResponse({ subject, unit, question });
  }

  const entry = insertQaHistory(
    studentId,
    { subject, unit: unit || subject, question },
    tutorResponse,
    meta,
    attachments,
  );

  return NextResponse.json({ entry, source });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    studentId?: string;
  } | null;

  const studentId =
    session.role === "family" ? resolveStudentIdentity(session).id : body?.studentId;

  if (!body?.id || !studentId) {
    return NextResponse.json(
      { error: "id, studentId は必須です" },
      { status: 400 },
    );
  }

  resolveTeacherCheck(body.id, studentId);
  return NextResponse.json({ ok: true });
}
