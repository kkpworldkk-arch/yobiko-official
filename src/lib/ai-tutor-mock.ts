import type { TutorResponse } from "@/lib/types";

/**
 * デモ用の擬似AI応答生成。実際のLLM APIには接続していない —
 * 教科ごとのテンプレートに質問文を差し込んで、それらしい解説を組み立てるだけ。
 * UIの見え方・体験を確認するためのモックであり、本物の採点・解説精度はない。
 */
const SUBJECT_FLAVOR: Record<string, { angle: string; tag: string }> = {
  数学: { angle: "与えられた条件をすべて書き出してから式を立てる", tag: "条件整理" },
  英語: { angle: "文全体をS・V・O・Cに分解して構造を見る", tag: "構文解析" },
  化学: { angle: "反応の全体像を先に描いてから量的関係に落とす", tag: "反応経路" },
  生物: { angle: "図式化してから専門用語を当てはめる", tag: "図式化" },
  物理: { angle: "力や運動が作用する点をすべて書き出してから立式する", tag: "作図" },
};

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function generateTutorResponse({
  subject,
  unit,
  question,
}: {
  subject: string;
  unit: string;
  question: string;
}): TutorResponse {
  const flavor = SUBJECT_FLAVOR[subject] ?? SUBJECT_FLAVOR["数学"];
  const unitLabel = unit.trim() || subject;
  const headline = truncate(question, 42) || "今回の質問";

  return {
    summary: `「${headline}」ですね。まずは${flavor.angle}ところから一緒に整理しましょう。`,
    steps: [
      "問題文から分かっている条件をすべて書き出す",
      `${unitLabel}の基本公式・定義に当てはめる`,
      flavor.angle,
      "計算結果を単位・桁数まで確認する",
    ],
    weaknessTag: `${unitLabel}-${flavor.tag}`,
    reviewSuggestion:
      "同系統の類題を3問、48時間以内に解き直すと定着しやすくなります。担当講師にも共有しておきました。",
  };
}
