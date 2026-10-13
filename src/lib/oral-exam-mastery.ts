import type { MasteryResult, OralExamMastery } from "@/lib/types";

/**
 * 「無意識に答えられるか」を単純な間隔反復（Leitner方式）で追跡する。
 * 正解が続くほどレベルが上がり復習間隔が伸び、誤答するとレベルが下がって
 * 早いタイミングで再出題される。
 */
export const MASTERY_LEVEL_LABELS = [
  "未着手",
  "学習中",
  "定着し始め",
  "定着",
  "得意",
  "無意識レベル",
] as const;

const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const MAX_LEVEL = REVIEW_INTERVAL_DAYS.length - 1;

export function masteryLevelLabel(level: number): string {
  return MASTERY_LEVEL_LABELS[Math.min(Math.max(level, 0), MAX_LEVEL)];
}

/**
 * 問題の種類。速さの測り方・基準・習熟度への反映が変わる。
 * - recall: 覚えているかを問う問題（英単語の意味、用語など）。思い出すまでの速さが重要。
 * - solve: その場で解く問題（数学の計算・証明など）。時間がかかって当然なので速さで減点しない。
 */
export type OralExamQuestionKind = "recall" | "solve";

const SOLVE_SUBJECT_RE = /数学|物理/;
const SOLVE_PROMPT_RE = /求めよ|求めなさい|計算せよ|計算しなさい|解け|解きなさい|証明せよ|証明しなさい|示せ|示しなさい/;

export function questionKind(question: { prompt: string }, bookSubject: string | null | undefined): OralExamQuestionKind {
  if (bookSubject && SOLVE_SUBJECT_RE.test(bookSubject)) return "solve";
  return SOLVE_PROMPT_RE.test(question.prompt) ? "solve" : "recall";
}

// recall は「読み上げ終了→答え始め」、solve は「読み上げ終了→回答送信」の時間に対する基準。
const SPEED_THRESHOLDS_MS: Record<OralExamQuestionKind, { instant: number; standard: number }> = {
  recall: { instant: 3_000, standard: 10_000 },
  solve: { instant: 60_000, standard: 180_000 },
};

export function speedLabel(
  responseTimeMs: number,
  kind: OralExamQuestionKind = "recall",
): "瞬答" | "標準" | "じっくり" {
  const { instant, standard } = SPEED_THRESHOLDS_MS[kind];
  if (responseTimeMs <= instant) return "瞬答";
  if (responseTimeMs <= standard) return "標準";
  return "じっくり";
}

// recall では「定着」より上（得意・無意識レベル）は瞬答で正解したときだけ上げる。
const RECALL_SPEED_GATED_FROM_LEVEL = 3;

export function computeNextMastery(
  previous: OralExamMastery | null,
  result: MasteryResult,
  responseTimeMs: number,
  kind: OralExamQuestionKind = "recall",
  now: Date = new Date(),
): Pick<
  OralExamMastery,
  | "level"
  | "correctStreak"
  | "totalAttempts"
  | "lastResult"
  | "lastResponseTimeMs"
  | "lastAttemptAt"
  | "nextReviewAt"
> {
  const prevLevel = previous?.level ?? 0;
  const prevStreak = previous?.correctStreak ?? 0;
  const prevAttempts = previous?.totalAttempts ?? 0;

  const slowRecall =
    kind === "recall" &&
    speedLabel(responseTimeMs, kind) !== "瞬答" &&
    prevLevel >= RECALL_SPEED_GATED_FROM_LEVEL;
  const level =
    result === "correct"
      ? slowRecall
        ? prevLevel
        : Math.min(prevLevel + 1, MAX_LEVEL)
      : Math.max(prevLevel - 2, 0);
  const correctStreak = result === "correct" ? prevStreak + 1 : 0;

  const intervalDays = REVIEW_INTERVAL_DAYS[level];
  const nextReviewAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return {
    level,
    correctStreak,
    totalAttempts: prevAttempts + 1,
    lastResult: result,
    lastResponseTimeMs: responseTimeMs,
    lastAttemptAt: now.toISOString(),
    nextReviewAt,
  };
}

export function isDue(mastery: OralExamMastery | null, now: Date = new Date()): boolean {
  if (!mastery || !mastery.nextReviewAt) return true;
  return new Date(mastery.nextReviewAt).getTime() <= now.getTime();
}
