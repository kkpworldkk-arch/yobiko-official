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

export function speedLabel(responseTimeMs: number): "瞬答" | "標準" | "じっくり" {
  if (responseTimeMs <= 6000) return "瞬答";
  if (responseTimeMs <= 20000) return "標準";
  return "じっくり";
}

export function computeNextMastery(
  previous: OralExamMastery | null,
  result: MasteryResult,
  responseTimeMs: number,
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

  const level =
    result === "correct"
      ? Math.min(prevLevel + 1, MAX_LEVEL)
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
