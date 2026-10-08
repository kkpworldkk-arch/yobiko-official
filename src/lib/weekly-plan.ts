import type { QaHistoryEntry } from "@/lib/types";

export interface WeeklyPlanBucket {
  label: string;
  description: string;
  entries: QaHistoryEntry[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// AIキー不要のルールベース振り分け。新しく聞いた質問ほど早いタイミングの
// 復習に割り当て、「復習完了」済みの質問は対象から外す。
export function buildWeeklyPlan(history: QaHistoryEntry[]): WeeklyPlanBucket[] {
  const today: QaHistoryEntry[] = [];
  const midWeek: QaHistoryEntry[] = [];
  const weekend: QaHistoryEntry[] = [];
  const now = Date.now();

  for (const entry of history) {
    if (entry.answerStatus === "復習完了") continue;
    const ageDays = (now - new Date(entry.askedAt).getTime()) / DAY_MS;
    if (ageDays < 2) today.push(entry);
    else if (ageDays < 5) midWeek.push(entry);
    else weekend.push(entry);
  }

  return [
    { label: "今日の復習", description: "直近2日以内の質問", entries: today.slice(0, 4) },
    { label: "3日後の復習", description: "2〜5日前の質問", entries: midWeek.slice(0, 4) },
    { label: "週末の復習", description: "5日以上前の質問", entries: weekend.slice(0, 4) },
  ].filter((bucket) => bucket.entries.length > 0);
}
