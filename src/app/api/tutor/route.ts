import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getQaHistory, insertQaHistory } from "@/lib/db";
import { generateTutorResponse } from "@/lib/ai-tutor-mock";
import type { TutorResponse } from "@/lib/types";

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
- 丁寧で温かみのある言葉遣いを保ちながら、学術的な正確さを最優先してください。
- steps は生徒がその場で実行できる具体的な手順にしてください（「頑張りましょう」等の精神論は禁止）。
- weaknessTag は必ず「単元名-つまずきの種類」の形式で1つだけ出力してください。
- reviewSuggestion は担当講師が読む前提で、今後48時間以内に取るべき具体的な復習行動を提案してください。`;

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json(
      { error: "studentId is required" },
      { status: 400 },
    );
  }
  return NextResponse.json({ history: getQaHistory(studentId) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const studentId = body?.studentId as string | undefined;
  const subject = body?.subject as string | undefined;
  const unit = (body?.unit as string | undefined)?.trim() ?? "";
  const question = (body?.question as string | undefined)?.trim() ?? "";

  if (!studentId || !subject || !question) {
    return NextResponse.json(
      { error: "studentId, subject, question は必須です" },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let tutorResponse: TutorResponse | null = null;
  let source: "claude" | "demo" = "demo";

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.parse({
        model: "claude-opus-4-8",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: {
          format: zodOutputFormat(TutorResponseSchema),
          effort: "high",
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `教科: ${subject}\n単元: ${unit || "指定なし"}\n質問内容:\n${question}`,
          },
        ],
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
  );

  return NextResponse.json({ entry, source });
}
