import type { QaHistoryEntry, Student } from "@/lib/types";

export const students: Student[] = [
  {
    id: "s-hoshino",
    name: "星野 陽菜",
    initials: "HH",
    grade: "高3",
    targetUniversity: "久留米大学",
    health: "urgent",
    pendingTeacherChecks: 3,
    questionsLast14Days: 21,
    totalQuestions: 214,
    lastActivity: "18分前",
    subjectBreakdown: [
      { subject: "数学", count: 9 },
      { subject: "化学", count: 6 },
      { subject: "英語", count: 4 },
      { subject: "生物", count: 2 },
    ],
    topStumbles: [
      { label: "確率-条件整理", count: 6 },
      { label: "有機-構造決定", count: 4 },
      { label: "英作文-時制", count: 2 },
    ],
    priorityAction: {
      headline: "確率-条件整理が2週間停滞",
      detail: "同系統の誤答が3回連続。明日の面談で解法の型から立て直す。",
    },
  },
  {
    id: "s-kitajima",
    name: "北島 蓮",
    initials: "KR",
    grade: "既卒1年",
    targetUniversity: "金沢医科大学",
    health: "watch",
    pendingTeacherChecks: 2,
    questionsLast14Days: 16,
    totalQuestions: 341,
    lastActivity: "1時間前",
    subjectBreakdown: [
      { subject: "英語", count: 7 },
      { subject: "数学", count: 5 },
      { subject: "物理", count: 3 },
    ],
    topStumbles: [
      { label: "構文-関係詞", count: 5 },
      { label: "力学-剛体", count: 3 },
    ],
    priorityAction: {
      headline: "構文-関係詞の質問が急増",
      detail: "先週比+4件。長文読解の土台を崩す前に個別テキストを配布したい。",
    },
  },
  {
    id: "s-takamine",
    name: "高峰 美咲",
    initials: "TM",
    grade: "高3",
    targetUniversity: "兵庫医科大学",
    health: "good",
    pendingTeacherChecks: 0,
    questionsLast14Days: 12,
    totalQuestions: 178,
    lastActivity: "3時間前",
    subjectBreakdown: [
      { subject: "生物", count: 6 },
      { subject: "化学", count: 4 },
      { subject: "数学", count: 2 },
    ],
    topStumbles: [{ label: "遺伝-計算処理", count: 3 }],
    priorityAction: {
      headline: "遺伝-計算処理は改善傾向",
      detail: "直近3問連続で自力正解。応用問題へ難度を一段階引き上げる。",
    },
  },
  {
    id: "s-endo",
    name: "遠藤 大和",
    initials: "ED",
    grade: "高3",
    targetUniversity: "福岡大学",
    health: "watch",
    pendingTeacherChecks: 1,
    questionsLast14Days: 9,
    totalQuestions: 96,
    lastActivity: "6時間前",
    subjectBreakdown: [
      { subject: "数学", count: 5 },
      { subject: "英語", count: 3 },
      { subject: "化学", count: 1 },
    ],
    topStumbles: [{ label: "微積分-計算処理", count: 4 }],
    priorityAction: {
      headline: "微積分-計算処理の確信度が「低」続き",
      detail: "解けても自信が持てていない。週末に類題演習を追加する。",
    },
  },
  {
    id: "s-sawaguchi",
    name: "澤口 千夏",
    initials: "SC",
    grade: "既卒2年",
    targetUniversity: "川崎医科大学",
    health: "good",
    pendingTeacherChecks: 0,
    questionsLast14Days: 14,
    totalQuestions: 402,
    lastActivity: "昨日",
    subjectBreakdown: [
      { subject: "化学", count: 6 },
      { subject: "生物", count: 5 },
      { subject: "英語", count: 3 },
    ],
    topStumbles: [{ label: "無機-反応経路", count: 3 }],
    priorityAction: {
      headline: "無機-反応経路は演習量で解消中",
      detail: "週次復習メニュー通りに進行。現状の負荷を維持する。",
    },
  },
  {
    id: "s-miyaura",
    name: "宮浦 健太",
    initials: "MK",
    grade: "高3",
    targetUniversity: "岩手医科大学",
    health: "urgent",
    pendingTeacherChecks: 4,
    questionsLast14Days: 7,
    totalQuestions: 63,
    lastActivity: "2日前",
    subjectBreakdown: [
      { subject: "英語", count: 4 },
      { subject: "数学", count: 3 },
    ],
    topStumbles: [{ label: "英文法-仮定法", count: 3 }],
    priorityAction: {
      headline: "2日間ログインなし・質問停滞",
      detail: "講師確認待ちが4件滞留。学習状況の確認連絡を優先する。",
    },
  },
];

export const teacher = {
  name: "滝原 一憲",
  role: "医学部専属コンシェルジュ",
};

// ログイン画面で「生徒・保護者」を選んだ場合に閲覧するデモ用の生徒アカウント
export const demoStudent = students[0];

const DAY_MS = 24 * 60 * 60 * 1000;

// DB初回起動時のシード用データ。askedAtはシード投入時点からの相対時刻で計算する。
export const demoStudentQaHistory: QaHistoryEntry[] = [
  {
    id: "q-seed-1",
    subject: "数学",
    unit: "確率",
    question: "サイコロを3回投げて出た目の積が偶数になる確率が求められません。",
    askedAt: new Date(Date.now() - DAY_MS).toISOString(),
    summary:
      "「積が偶数になる確率」ですね。まずは余事象（積が奇数になる確率）を考えるところから整理しましょう。",
    steps: [
      "積が偶数になるのは「少なくとも1回偶数の目が出る」場合だと確認する",
      "余事象「3回とも奇数の目が出る」確率を先に求める",
      "1から余事象の確率を引いて答えを出す",
      "分母・分子の約分を最後にもう一度確認する",
    ],
    weaknessTag: "確率-条件整理",
    reviewSuggestion:
      "余事象を使う類題を3問、48時間以内に解き直すことをおすすめします。",
  },
  {
    id: "q-seed-2",
    subject: "化学",
    unit: "有機化学",
    question: "構造決定の問題で、どの反応から手をつければいいか分かりません。",
    askedAt: new Date(Date.now() - 3 * DAY_MS).toISOString(),
    summary:
      "構造決定は「与えられた実験事実を分類する」ところから始めると迷いにくくなります。",
    steps: [
      "分子式から不飽和度を計算し、環・二重結合の数を絞り込む",
      "官能基特有の反応（酸化・還元・エステル化など)の実験事実を分類する",
      "候補構造をいくつか書き出し、矛盾する実験事実を消去法で除外する",
      "最終候補が全ての実験事実と整合するか見直す",
    ],
    weaknessTag: "有機-構造決定",
    reviewSuggestion: "不飽和度の計算だけを繰り返す小テストを週末に行いましょう。",
  },
  {
    id: "q-seed-3",
    subject: "英語",
    unit: "英作文",
    question: "和文英訳で時制の使い分けがいつも不安になります。",
    askedAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
    summary:
      "時制は「その動作が完了しているか、継続しているか」を日本語から先に判定すると安定します。",
    steps: [
      "和文の動作が「一回きり」か「継続・習慣」かを見極める",
      "時間を表す語句（すでに、ずっと、今まで等)を手がかりに時制を仮決定する",
      "主節と従属節の時制が対応しているか確認する",
      "仮決定した時制で英文を組み立て、不自然さがないか読み返す",
    ],
    weaknessTag: "英作文-時制",
    reviewSuggestion: "現在完了と過去形を対比させる英作文を5題、週内に添削に出しましょう。",
  },
];

export const todaysNewQuestions = 8;
export const todaysNewQuestionsDelta = "+3";

export const totalPendingChecks = students.reduce(
  (sum, student) => sum + student.pendingTeacherChecks,
  0,
);

export const totalQuestionsLast14Days = students.reduce(
  (sum, student) => sum + student.questionsLast14Days,
  0,
);

export const priorityQueue = [...students]
  .sort((a, b) => {
    const rank: Record<string, number> = { urgent: 0, watch: 1, good: 2 };
    if (rank[a.health] !== rank[b.health]) return rank[a.health] - rank[b.health];
    return b.pendingTeacherChecks - a.pendingTeacherChecks;
  })
  .slice(0, 4);

export const subjectTotals = [
  { subject: "数学", count: 24 },
  { subject: "英語", count: 21 },
  { subject: "化学", count: 17 },
  { subject: "生物", count: 11 },
  { subject: "物理", count: 3 },
];

export const stumbleTotals = [
  { label: "確率-条件整理", count: 6 },
  { label: "構文-関係詞", count: 5 },
  { label: "微積分-計算処理", count: 4 },
  { label: "有機-構造決定", count: 4 },
  { label: "英文法-仮定法", count: 3 },
];
