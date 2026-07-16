import type { Student } from "@/lib/types";

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
