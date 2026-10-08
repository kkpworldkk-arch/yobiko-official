import Anthropic from "@anthropic-ai/sdk";
import type { OralExamAttempt } from "@/lib/types";

const SYSTEM_PROMPT = `あなたは個別指導塾「滝原塾」の学習コーチです。生徒の口頭試問(一問一答)の記録をもとに、
講師向けに、指導に役立つ短い要約とアドバイスを日本語で書いてください。

- 全体で3〜4文程度。箇条書きではなく自然な文章で。
- 生徒の理解度の傾向、特につまずいている分野・単元があれば具体的に触れる。
- 次回の指導ですぐ使えるアドバイスを1つ含める。
- 誇張や根拠のない断定は避け、与えられたデータの範囲で述べる。`;

export async function generateOralExamInsight(input: {
  studentName: string;
  totalQuestions: number;
  masteredCount: number;
  dueCount: number;
  totalAttempts: number;
  recentAttempts: Pick<
    OralExamAttempt,
    "bookTitle" | "category" | "questionPrompt" | "isCorrect" | "evaluation"
  >[];
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const attemptLines = input.recentAttempts
    .slice(0, 10)
    .map(
      (a) =>
        `- [${a.isCorrect ? "正解" : "不正解"}] ${a.bookTitle}${a.category ? `(${a.category})` : ""}: ${a.questionPrompt}`,
    )
    .join("\n");

  const userContent = `生徒: ${input.studentName}
総問題数: ${input.totalQuestions}
習得済み: ${input.masteredCount}
復習待ち: ${input.dueCount}
総回答数: ${input.totalAttempts}

直近の回答(新しい順、最大10件):
${attemptLines || "(まだ回答がありません)"}`;

  try {
    const client = new Anthropic({ apiKey });
    // 要約・アドバイス生成は軽いテキスト処理のため、安価なモデルで十分。
    // (このモデルのスナップショットはeffortパラメータ非対応のため指定していない。
    //  既にAnthropicの最安クラスのモデルであり、これより下げる余地はない)
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const text = message.content
      .filter((part): part is Anthropic.TextBlock => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    return text || null;
  } catch (error) {
    console.error("oral exam insight generation failed:", error);
    return null;
  }
}
