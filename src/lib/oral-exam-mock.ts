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

// App Store 審査・体験用の問題集。市販の参考書を使わず、この塾で独自に作成した問題だけで構成する。
// 審査用に作ったテスト生徒（REVIEW_STUDENT_ID）には、この問題集と全参考書を割り当てる（db.ts の ensureReviewSampleBook）。
// 「覚えているかを問う問題」と「解く問題」（求めよ・解け）の両方を含め、反応時間の判定も確認できるようにしている。
export const reviewSampleBookSeed = {
  book: {
    title: "体験用サンプル問題集",
    subject: "体験用",
    description:
      "アプリの使い方を体験するための、滝原塾オリジナルの一問一答です。覚えているかを問う問題と、その場で解く問題が含まれています。",
  },
  questions: [
    { category: "生物", prompt: "血液中で酸素を運ぶ、赤血球に含まれるタンパク質は何ですか。", modelAnswer: "ヘモグロビン" },
    { category: "生物", prompt: "ヒトの体細胞1つに含まれる染色体は何本ですか。", modelAnswer: "46本" },
    { category: "生物", prompt: "DNAの塩基のうち、アデニンと対になる塩基は何ですか。", modelAnswer: "チミン" },
    { category: "生物", prompt: "血糖値を下げるはたらきをもつ、すい臓から分泌されるホルモンは何ですか。", modelAnswer: "インスリン" },
    { category: "化学", prompt: "原子番号6の元素は何ですか。", modelAnswer: "炭素（C）" },
    { category: "化学", prompt: "25℃で水溶液のpHが7より小さいとき、その水溶液は何性ですか。", modelAnswer: "酸性" },
    { category: "化学", prompt: "物質1molあたりに含まれる粒子の数を表す定数を何といいますか。", modelAnswer: "アボガドロ定数（約6.0×10²³/mol）" },
    { category: "物理", prompt: "力の単位ニュートン（N）を、kg・m・sを使って表すとどうなりますか。", modelAnswer: "kg·m/s²" },
    { category: "英語", prompt: "「diagnosis」の意味を日本語で答えてください。", modelAnswer: "診断" },
    { category: "英語", prompt: "「symptom」の意味を日本語で答えてください。", modelAnswer: "症状" },
    { category: "英語", prompt: "「infection」の意味を日本語で答えてください。", modelAnswer: "感染" },
    { category: "数学", prompt: "2次方程式 x² − 7x + 12 = 0 を解け。", modelAnswer: "x = 3, 4" },
    { category: "数学", prompt: "等差数列 3, 7, 11, … の第10項を求めよ。", modelAnswer: "39" },
    { category: "数学", prompt: "関数 f(x) = x³ − 3x の極大値を求めよ。", modelAnswer: "x = −1 のとき極大値 2" },
    { category: "数学", prompt: "さいころを2回投げるとき、出た目の和が7になる確率を求めよ。", modelAnswer: "1/6" },
    { category: "化学", prompt: "水18gは何molか。原子量を H = 1、O = 16 として求めよ。", modelAnswer: "1 mol" },
  ],
};
