export interface OralExamMockFeedback {
  evaluation: string;
  strengths: string[];
  improvements: string[];
  isCorrect: boolean;
}

/**
 * 初回起動時に登録する、デモ用の「参考書」の種データ。
 * 口頭試問は面接対策ではなく、1冊の参考書の内容を無意識に即答できるレベルまで
 * 覚え込むための一問一答ドリルであることを示すためのサンプル（実際の教科・内容とは無関係）。
 * 講師が実際の参考書データを登録し次第、この内容は使われなくなる
 * （teacher側の参考書管理画面から自由に追加・編集・削除できる）。
 */
export const demoOralExamBookSeed = {
  book: {
    title: "動作確認用サンプル問題集",
    subject: "サンプル",
    description:
      "講師から正式な参考書データが届くまでの間、動作確認用に用意しているダミーの一問一答です。実際の参考書を登録すると、この参考書は使われなくなります。",
  },
  questions: [
    {
      category: "サンプル",
      prompt: "日本の首都はどこですか。",
      modelAnswer: "東京",
    },
    {
      category: "サンプル",
      prompt: "水の化学式は何ですか。",
      modelAnswer: "H2O",
    },
    {
      category: "サンプル",
      prompt: "うるう年を除いて、1年は何日ですか。",
      modelAnswer: "365日",
    },
    {
      category: "サンプル",
      prompt: "三角形の内角の和は何度ですか。",
      modelAnswer: "180度",
    },
    {
      category: "サンプル",
      prompt: "光合成を行う細胞小器官の名前は何ですか。",
      modelAnswer: "葉緑体",
    },
    {
      category: "サンプル",
      prompt: "「ありがとう」を英語で一語で言うと何ですか。",
      modelAnswer: "Thank you",
    },
  ],
};

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function roughlyMatches(answerText: string, modelAnswer: string): boolean {
  if (!modelAnswer.trim()) return answerText.trim().length >= 20;
  const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const answer = normalize(answerText);
  const model = normalize(modelAnswer);
  if (!answer) return false;
  // モデル解答の文字の何割が回答に含まれているかで大まかに判定する
  const modelChars = Array.from(new Set(model));
  const hitCount = modelChars.filter((ch) => answer.includes(ch)).length;
  return modelChars.length > 0 && hitCount / modelChars.length >= 0.5;
}

/**
 * デモ用の擬似AI評価。実際のLLM APIには接続していない —
 * 模範解答との大まかな一致度から、それらしい正誤判定とフィードバックを組み立てるだけ。
 * UIの見え方・体験を確認するためのモックであり、本物の採点精度はない。
 */
export function generateOralExamFeedback({
  question,
  answerText,
  modelAnswer,
}: {
  question: string;
  answerText: string;
  modelAnswer: string;
}): OralExamMockFeedback {
  const headline = truncate(question, 36);
  const isCorrect = roughlyMatches(answerText, modelAnswer);

  if (isCorrect) {
    return {
      evaluation: `「${headline}」に正しく答えられています。この調子で繰り返し、考えずに即答できるレベルまで定着させましょう。`,
      strengths: ["模範解答の要点を押さえて即答できている点"],
      improvements: ["次回はさらに短い時間で答えられるよう繰り返し練習しましょう"],
      isCorrect: true,
    };
  }

  return {
    evaluation: modelAnswer
      ? `「${headline}」の模範解答は「${modelAnswer}」です。まだ完全には定着していないので、繰り返し復習しましょう。`
      : `「${headline}」への回答を確認しました。もう少し具体的に答えられるとよいでしょう。`,
    strengths: ["質問に対して回答しようとしている点"],
    improvements: ["模範解答を確認し、間を置いてもう一度同じ問題に挑戦してみましょう"],
    isCorrect: false,
  };
}
