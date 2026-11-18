import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  getAnalysisAttempts,
  getOralExamAnalyses,
  insertOralExamAnalysis,
  jstDay,
  type AnalysisAttempt,
} from "@/lib/db";

// 口頭試問（回答）が、この回数たまるごとに分析を1回完了させる
export const ANALYSIS_INTERVAL = 20;

export interface GroupStat {
  label: string;
  total: number;
  correct: number;
  accuracy: number;
  avgResponseTimeMs: number;
}

export interface AnalysisStats {
  total: number;
  correct: number;
  accuracy: number;
  avgResponseTimeMs: number;
  // 反応が遅い(同じ生徒の中央値の2倍以上)のに正解した問題の数。覚え方が浅い兆候
  slowCorrectCount: number;
  bySubject: GroupStat[];
  byBook: GroupStat[];
  byCategory: GroupStat[];
  byInputMode: GroupStat[];
  byQuestionKind: GroupStat[];
  bySessionKind: GroupStat[];
  byTimeBand: GroupStat[];
  // 同じ問題を2回以上間違えている
  repeatMisses: Array<{ prompt: string; bookTitle: string; missCount: number }>;
  topImprovements: Array<{ text: string; count: number }>;
  handwritingTotal: number;
  handwritingCorrected: number;
  // 前回の分析区間との比較（初回は null）
  accuracyDelta: number | null;
  timeDeltaMs: number | null;
}

export interface AnalysisNarrative {
  summary: string;
  causes: string[];
  teacherActions: string[];
  studentAdvice: string[];
}

const INPUT_MODE_LABEL: Record<string, string> = { voice: "音声", handwriting: "手書き", keyboard: "キーボード" };
const KIND_LABEL: Record<string, string> = { recall: "暗記型(思い出す)", solve: "計算・思考型(解く)" };
const SESSION_LABEL: Record<string, string> = { regular: "通常の口頭試問", daily: "デイリーテスト" };

function groupBy(
  attempts: AnalysisAttempt[],
  keyOf: (attempt: AnalysisAttempt) => string,
  minTotal = 1,
): GroupStat[] {
  const map = new Map<string, { total: number; correct: number; time: number }>();
  for (const attempt of attempts) {
    const key = keyOf(attempt);
    if (!key) continue;
    const entry = map.get(key) ?? { total: 0, correct: 0, time: 0 };
    entry.total += 1;
    entry.correct += attempt.isCorrect ? 1 : 0;
    entry.time += attempt.responseTimeMs;
    map.set(key, entry);
  }
  return [...map.entries()]
    .filter(([, entry]) => entry.total >= minTotal)
    .map(([label, entry]) => ({
      label,
      total: entry.total,
      correct: entry.correct,
      accuracy: entry.correct / entry.total,
      avgResponseTimeMs: entry.time / entry.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

function timeBand(iso: string): string {
  const hour = (new Date(iso).getUTCHours() + 9) % 24;
  if (hour < 12) return "午前(〜12時)";
  if (hour < 17) return "午後(12〜17時)";
  if (hour < 21) return "夕方・夜(17〜21時)";
  return "夜遅く(21時〜)";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(attempts: AnalysisAttempt[]): { accuracy: number; avgTime: number } {
  if (attempts.length === 0) return { accuracy: 0, avgTime: 0 };
  return {
    accuracy: attempts.filter((a) => a.isCorrect).length / attempts.length,
    avgTime: attempts.reduce((sum, a) => sum + a.responseTimeMs, 0) / attempts.length,
  };
}

/** attempts: 分析する区間の回答。history: その生徒の全回答（繰り返しの誤りの判定用）。before: 区間より前の回答。 */
export function computeStats(
  attempts: AnalysisAttempt[],
  history: AnalysisAttempt[],
  before: AnalysisAttempt[],
): AnalysisStats {
  const now = summarize(attempts);
  const medianTime = median(history.map((a) => a.responseTimeMs));

  const missCounts = new Map<string, { prompt: string; bookTitle: string; missCount: number }>();
  const inPeriod = new Set(attempts.map((a) => a.questionId));
  for (const attempt of history) {
    if (attempt.isCorrect || !inPeriod.has(attempt.questionId)) continue;
    const entry = missCounts.get(attempt.questionId) ?? {
      prompt: attempt.questionPrompt,
      bookTitle: attempt.bookTitle,
      missCount: 0,
    };
    entry.missCount += 1;
    missCounts.set(attempt.questionId, entry);
  }

  const improvementCounts = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.isCorrect) continue;
    for (const text of attempt.improvements) {
      improvementCounts.set(text, (improvementCounts.get(text) ?? 0) + 1);
    }
  }

  const handwriting = attempts.filter((a) => a.inputMode === "handwriting");
  const prev = before.length > 0 ? summarize(before.slice(-ANALYSIS_INTERVAL)) : null;

  return {
    total: attempts.length,
    correct: attempts.filter((a) => a.isCorrect).length,
    accuracy: now.accuracy,
    avgResponseTimeMs: now.avgTime,
    slowCorrectCount:
      medianTime > 0 ? attempts.filter((a) => a.isCorrect && a.responseTimeMs >= medianTime * 2).length : 0,
    bySubject: groupBy(attempts, (a) => a.subject),
    byBook: groupBy(attempts, (a) => a.bookTitle),
    byCategory: groupBy(attempts, (a) => a.category, 2),
    byInputMode: groupBy(attempts, (a) => INPUT_MODE_LABEL[a.inputMode] ?? a.inputMode),
    byQuestionKind: groupBy(attempts, (a) => KIND_LABEL[a.questionKind] ?? ""),
    bySessionKind: groupBy(attempts, (a) => SESSION_LABEL[a.sessionKind] ?? ""),
    byTimeBand: groupBy(attempts, (a) => timeBand(a.createdAt)),
    repeatMisses: [...missCounts.values()]
      .filter((entry) => entry.missCount >= 2)
      .sort((a, b) => b.missCount - a.missCount)
      .slice(0, 5),
    topImprovements: [...improvementCounts.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    handwritingTotal: handwriting.length,
    handwritingCorrected: handwriting.filter((a) => a.transcriptionCorrected).length,
    accuracyDelta: prev ? now.accuracy - prev.accuracy : null,
    timeDeltaMs: prev ? now.avgTime - prev.avgTime : null,
  };
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const sec = (ms: number) => `${Math.round(ms / 100) / 10}秒`;

/** 数値から機械的に言える「特徴」。AIが使えなくても必ず出せる。 */
export function deriveFeatures(stats: AnalysisStats): string[] {
  const features: string[] = [];
  features.push(`正答率は${pct(stats.accuracy)}(${stats.correct}/${stats.total}問)、平均反応時間は${sec(stats.avgResponseTimeMs)}です。`);

  if (stats.accuracyDelta !== null) {
    const delta = Math.round(stats.accuracyDelta * 100);
    if (delta <= -10) features.push(`前回の区間より正答率が${Math.abs(delta)}ポイント下がっています。`);
    else if (delta >= 10) features.push(`前回の区間より正答率が${delta}ポイント上がっています。`);
  }

  const weak = (groups: GroupStat[], name: string) => {
    const worst = groups.find((g) => g.total >= 3 && g.accuracy <= 0.5);
    if (worst) features.push(`${name}では「${worst.label}」の正答率が${pct(worst.accuracy)}(${worst.correct}/${worst.total}問)と低めです。`);
  };
  weak(stats.bySubject, "教科");
  weak(stats.byBook, "参考書");
  weak(stats.byCategory, "分野");

  if (stats.byInputMode.length > 1) {
    const [low, ...rest] = stats.byInputMode;
    const best = rest[rest.length - 1];
    if (low.total >= 3 && best.total >= 3 && best.accuracy - low.accuracy >= 0.2) {
      features.push(`回答方法では「${low.label}」(${pct(low.accuracy)})が「${best.label}」(${pct(best.accuracy)})より正答率が低いです。`);
    }
  }
  if (stats.handwritingTotal >= 3 && stats.handwritingCorrected / stats.handwritingTotal >= 0.2) {
    features.push(`手書き${stats.handwritingTotal}件のうち${stats.handwritingCorrected}件で読み取りの訂正がありました。字の読み取りが原因で不正解になっている可能性があります。`);
  }
  if (stats.byQuestionKind.length > 1) {
    const [low] = stats.byQuestionKind;
    if (low.total >= 3 && low.accuracy <= 0.6) features.push(`問題の種類では「${low.label}」が苦手です(${pct(low.accuracy)})。`);
  }
  if (stats.slowCorrectCount >= 3) {
    features.push(`正解でも反応が遅い問題が${stats.slowCorrectCount}問あります。知識がまだ「無意識レベル」に届いていません。`);
  }
  if (stats.repeatMisses.length > 0) {
    features.push(`同じ問題を2回以上間違えているものが${stats.repeatMisses.length}問あります(例: ${stats.repeatMisses[0].prompt.slice(0, 30)})。`);
  }
  const band = stats.byTimeBand.find((g) => g.total >= 4 && g.accuracy <= 0.5);
  if (band) features.push(`「${band.label}」に取り組んだときの正答率が${pct(band.accuracy)}と低めです。`);

  return features;
}

const NarrativeSchema = z.object({
  summary: z.string().describe("この生徒のつまずきの全体像を、講師向けに3〜4文で"),
  causes: z.array(z.string()).describe("数値から考えられるつまずきの原因を2〜4個。根拠となる数値を添える"),
  teacherActions: z.array(z.string()).describe("講師が次の指導でできる具体的な働きかけを2〜4個"),
  studentAdvice: z.array(z.string()).describe("生徒に伝えるとよい、すぐ実行できる学習のコツを2〜3個"),
});

const SYSTEM_PROMPT = `あなたは個別指導塾「滝原塾」の講師を支援するデータ分析AIです。
生徒が参考書の内容を口頭試問(一問一答)で答えた記録の集計から、「その生徒がなぜつまずいているか」を講師向けに分析します。

方針:
- 与えられた数値と事実だけを根拠にしてください。数値にない事柄を推測で断定しないでください(「〜の可能性があります」と表現する)。
- 回答数が少ない区分は偶然の影響が大きいので、強く言いすぎないでください。
- 正答率が高く課題が少ない場合は、無理に問題点を作らず、次の伸ばし方を示してください。
- 生徒本人を責めない、丁寧で前向きな言葉遣いにしてください。講師がそのまま指導に使える具体性を重視してください。`;

function ruleNarrative(stats: AnalysisStats, features: string[]): AnalysisNarrative {
  return {
    summary: features.slice(0, 3).join(" "),
    causes: features.slice(1, 4),
    teacherActions: [
      stats.repeatMisses.length > 0
        ? "繰り返し間違えている問題を、講師が一緒に確認し、覚え方を作り直してください。"
        : "間違えた問題を、次の口頭試問の前に口頭で復習してください。",
    ],
    studentAdvice: ["間違えた問題は、翌日のデイリーテストでもう一度解いてみましょう。"],
  };
}

async function generateNarrative(
  studentName: string,
  stats: AnalysisStats,
  features: string[],
  sampleMisses: AnalysisAttempt[],
): Promise<{ narrative: AnalysisNarrative; source: "claude" | "rule" } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { narrative: ruleNarrative(stats, features), source: "rule" };
  try {
    const client = new Anthropic({ apiKey });
    const lines = [
      `生徒: ${studentName}`,
      `直近${stats.total}回答の集計: ${JSON.stringify({ ...stats, repeatMisses: undefined })}`,
      `機械的に見つけた特徴:\n${features.map((f) => `- ${f}`).join("\n")}`,
      stats.repeatMisses.length > 0 && `繰り返し間違えている問題:\n${stats.repeatMisses.map((m) => `- [${m.bookTitle}] ${m.prompt}(${m.missCount}回)`).join("\n")}`,
      sampleMisses.length > 0 &&
        `間違えた回答の例:\n${sampleMisses
          .map((a) => `- [${a.bookTitle}] ${a.questionPrompt} → 生徒の回答: ${a.answerText.slice(0, 80)}(反応${sec(a.responseTimeMs)})`)
          .join("\n")}`,
    ].filter(Boolean);
    const message = await client.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
      output_config: { format: zodOutputFormat(NarrativeSchema), effort: "medium" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: lines.join("\n\n") }],
    });
    if (message.parsed_output) return { narrative: message.parsed_output, source: "claude" };
  } catch (error) {
    console.error("Claude API error in oral-exam analysis:", error);
  }
  // AIが失敗したときは保存せず、次の回答のときにもう一度試す
  return null;
}

// 同じ生徒の分析が同時に2回走らないようにする
const running = new Set<string>();

/**
 * 前回の分析から回答がANALYSIS_INTERVAL件たまっていれば、分析(データ→特徴→分析)を1回完了させて保存する。
 * 回答の保存のあとに呼ぶ。待たずに投げっぱなしにしてよい。
 */
export async function runAnalysisIfDue(studentId: string, studentName: string): Promise<boolean> {
  if (running.has(studentId)) return false;
  running.add(studentId);
  try {
    const history = getAnalysisAttempts(studentId);
    const last = getOralExamAnalyses(studentId)[0];
    const analyzed = last?.attemptCount ?? 0;
    if (history.length - analyzed < ANALYSIS_INTERVAL) return false;

    // 前回の分析のあとに増えた回答すべてを、今回の区間とする
    const period = history.slice(analyzed);
    const before = history.slice(0, analyzed);
    const stats = computeStats(period, history, before);
    const features = deriveFeatures(stats);
    const misses = period.filter((a) => !a.isCorrect).slice(-6);
    const result = await generateNarrative(studentName, stats, features, misses);
    if (!result) return false;

    insertOralExamAnalysis({
      studentId,
      attemptCount: history.length,
      periodFrom: jstDay(period[0].createdAt),
      periodTo: jstDay(period[period.length - 1].createdAt),
      statsJson: JSON.stringify(stats),
      featuresJson: JSON.stringify(features),
      analysisJson: JSON.stringify(result.narrative),
      source: result.source,
    });
    return true;
  } finally {
    running.delete(studentId);
  }
}

/** いまの全回答から計算した最新の数値と特徴(次の分析を待たずに見られる)。 */
export function liveStatsForStudent(studentId: string): { stats: AnalysisStats; features: string[] } | null {
  const history = getAnalysisAttempts(studentId);
  if (history.length === 0) return null;
  const stats = computeStats(history, history, []);
  return { stats, features: deriveFeatures(stats) };
}
