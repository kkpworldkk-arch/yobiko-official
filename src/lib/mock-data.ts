import type { QaHistoryEntry, Student } from "@/lib/types";

export const SUBJECTS = ["数学", "英語", "化学", "生物", "物理"];
export const UNIVERSITIES = [
  "久留米大学",
  "金沢医科大学",
  "福岡大学",
  "川崎医科大学",
  "兵庫医科大学",
  "岩手医科大学",
  "北海道大学",
  "東京女子医科大学",
];

export const students: Student[] = [
  {
    id: "s-tanifuji",
    name: "谷藤丈二",
    email: "tanifuji_jyouji@icloud.com",
    initials: "TJ",
    grade: "既卒４年",
    targetUniversity: "岩手医科大学",
    health: "urgent",
    pendingTeacherChecks: 3,
    questionsLast14Days: 21,
    totalQuestions: 214,
    lastActivity: "18分前",
    subjectBreakdown: [{ subject: "数学", count: 9 }, { subject: "化学", count: 6 }, { subject: "英語", count: 4 }],
    topStumbles: [{ label: "数学-典型解法", count: 6 }, { label: "化学-反応整理", count: 4 }],
    priorityAction: { headline: "参考書の口頭試問を優先", detail: "重要事項の即答練習を進める。" },
  },
  {
    id: "s-yashita",
    name: "谷下田博生",
    email: "yahitaki324@icloud.com",
    initials: "YH",
    grade: "既卒３年",
    targetUniversity: "金沢医科大学",
    health: "watch",
    pendingTeacherChecks: 2,
    questionsLast14Days: 16,
    totalQuestions: 341,
    lastActivity: "1時間前",
    subjectBreakdown: [{ subject: "英語", count: 7 }, { subject: "数学", count: 5 }, { subject: "化学", count: 3 }],
    topStumbles: [{ label: "英語-医療語彙", count: 5 }, { label: "数学-図形処理", count: 3 }],
    priorityAction: { headline: "医療英単語の口頭確認を開始", detail: "短時間反復へ移行する。" },
  },
  {
    id: "s-hirata",
    name: "平田孝雄",
    email: "takanori_hirata0511@icloud.com",
    initials: "HT",
    grade: "既卒２年",
    targetUniversity: "北海道大学",
    health: "good",
    pendingTeacherChecks: 0,
    questionsLast14Days: 12,
    totalQuestions: 178,
    lastActivity: "3時間前",
    subjectBreakdown: [{ subject: "生物", count: 6 }, { subject: "化学", count: 4 }, { subject: "数学", count: 2 }],
    topStumbles: [{ label: "生物-重要語句", count: 3 }],
    priorityAction: { headline: "生物基礎の問題化を待機", detail: "本文確認後、重要語句の口頭試問を追加する。" },
  },
  {
    id: "s-suzuki",
    name: "鈴木晴夏",
    email: "haruka.mk67@i.softbank.jp",
    initials: "SH",
    grade: "既卒９年",
    targetUniversity: "東京女子医科大学",
    health: "watch",
    pendingTeacherChecks: 1,
    questionsLast14Days: 9,
    totalQuestions: 96,
    lastActivity: "6時間前",
    subjectBreakdown: [{ subject: "数学", count: 5 }, { subject: "英語", count: 3 }, { subject: "化学", count: 1 }],
    topStumbles: [{ label: "数学-解法説明", count: 4 }],
    priorityAction: { headline: "数学の解法を口頭で説明", detail: "解法の根拠まで説明する練習を進める。" },
  },
  {
    id: "s-test-family",
    name: "ゲスト生徒",
    email: "test.family@example.com",
    initials: "GT",
    grade: "テスト",
    targetUniversity: "テスト大学",
    health: "good",
    pendingTeacherChecks: 0,
    questionsLast14Days: 0,
    totalQuestions: 0,
    lastActivity: "未実施",
    subjectBreakdown: [],
    topStumbles: [],
    priorityAction: { headline: "テスト用アカウント", detail: "口頭試問の動作確認に使用します。" },
  },
];

export const teacher = {
  name: "滝原 一憲",
  role: "医学部専属コンシェルジュ",
};

// ログイン画面で「生徒・保護者」を選んだ場合に閲覧するデモ用の生徒アカウント
export const demoStudent = students[0];

const DAY_MS = 24 * 60 * 60 * 1000;

const seedMetaDefaults = {
  university: demoStudent.targetUniversity,
  year: "",
  difficulty: "標準" as const,
  format: "普段の問題" as const,
  inputType: "テキスト" as const,
  studentAttempt: "",
  answerStatus: "復習完了" as const,
  confidence: "中" as const,
  weaknessHint: "",
  teacherCheckNeeded: false,
  teacherCheckResolved: true,
  attachments: [],
};

// DB初回起動時のシード用データ。askedAtはシード投入時点からの相対時刻で計算する。
export const demoStudentQaHistory: QaHistoryEntry[] = [
  {
    id: "q-seed-1",
    studentId: demoStudent.id,
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
    ...seedMetaDefaults,
  },
  {
    id: "q-seed-2",
    studentId: demoStudent.id,
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
    ...seedMetaDefaults,
  },
  {
    id: "q-seed-3",
    studentId: demoStudent.id,
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
    ...seedMetaDefaults,
  },
];

