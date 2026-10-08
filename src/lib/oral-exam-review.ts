import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const ReviewSchema = z.object({
  status: z
    .enum(["ok", "fixed", "blocked"])
    .describe(
      "ok=このまま出題してよい, fixed=修正して出題する, blocked=修正不可能なので今後出題しない",
    ),
  prompt: z.string().optional().describe("status が ok または fixed の場合の、最終的な質問文"),
  modelAnswer: z
    .string()
    .optional()
    .describe("status が ok または fixed の場合の、最終的な模範解答"),
  reason: z.string().describe("判定理由を1文で簡潔に"),
});

const SYSTEM_PROMPT = `あなたは個別指導塾の教材編集者です。口頭試問(一問一答)用の「質問文」と「模範解答」の
ペアを、生徒に出題する直前に点検します。OCRで参考書から抽出したデータなので、誤字や、
前後の文脈が失われた断片が混ざっています。

status の判定基準:
- "blocked"(今後出題しない)にすべき場合:
  - 文字が意味不明に壊れている(OCRの誤読で文として成立していない)
  - 「(ア)」「(イ)」「A」「B」「a〜e」のような、図表や前後の文脈でしか分からない記号・
    仮の名前を使っており、この一組の質問・答えだけでは何を指すか分からない
  - 模範解答が、質問をそのまま繰り返すだけ、または具体的な内容(用語・数値・理由)を
    含まない
  - 選択肢の一部の文(正しいか誤りか文脈なしに判断できないもの)をそのまま出題にしている
  - 科学的・事実として明らかに誤っている、または自信を持って正しいと言えない
- "fixed"(修正して出題): 軽微な誤字(OCRの読み間違いなど)があるが、文脈から元の正しい
  表現が明らかに推測できる場合は、その誤字だけを直して採用してよい。質問・答えの構造
  そのものに問題がなければ、言い回しを変える必要はない。
- "ok": 上記のいずれにも当てはまらず、このまま出題して問題ない場合。

新しい知識を付け足したり、元の内容から推測で話を広げたりしないでください。
判断に迷ったら、無理に"fixed"にせず"blocked"にしてください（出題されない方が、誤った
内容を教えるよりも安全です）。`;

export type ReviewResult =
  | { status: "ok" }
  | { status: "fixed"; prompt: string; modelAnswer: string }
  | { status: "blocked"; reason: string }
  | { status: "error" };

export async function reviewOralExamQuestion(question: {
  category: string;
  prompt: string;
  modelAnswer: string;
}): Promise<ReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // キー未設定時は点検自体をスキップし、これまで通り出題する(機能を壊さないため)。
    return { status: "ok" };
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 600,
      output_config: { format: zodOutputFormat(ReviewSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `カテゴリ: ${question.category}\n質問: ${question.prompt}\n模範解答: ${question.modelAnswer}`,
        },
      ],
    });

    const result = message.parsed_output;
    if (!result) return { status: "error" };

    if (result.status === "blocked") {
      return { status: "blocked", reason: result.reason };
    }
    if (result.status === "fixed" && result.prompt?.trim() && result.modelAnswer?.trim()) {
      return { status: "fixed", prompt: result.prompt.trim(), modelAnswer: result.modelAnswer.trim() };
    }
    return { status: "ok" };
  } catch (error) {
    console.error("oral exam question review failed:", error);
    return { status: "error" };
  }
}
