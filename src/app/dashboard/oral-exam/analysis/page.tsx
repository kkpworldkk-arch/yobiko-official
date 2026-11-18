import Link from "next/link";
import { ArrowLeft, ChevronRight, LineChart } from "lucide-react";
import { getAttemptTotals, getLatestOralExamAnalysisMap } from "@/lib/db";
import { ANALYSIS_INTERVAL, liveStatsForStudent, type AnalysisNarrative } from "@/lib/oral-exam-analysis";
import { getRoster } from "@/lib/roster";

// 回答は毎回増えるので、静的レンダリングのキャッシュを無効化する
export const dynamic = "force-dynamic";

const pct = (value: number) => `${Math.round(value * 100)}%`;
const sec = (ms: number) => `${Math.round(ms / 100) / 10}秒`;
const average = (values: number[]) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);

export default function OralExamAnalysisPage() {
  const roster = getRoster();
  const totals = getAttemptTotals();
  const latest = getLatestOralExamAnalysisMap();

  const rows = roster
    .map((student) => {
      const total = totals.get(student.id) ?? 0;
      const analysis = latest.get(student.id) ?? null;
      const live = liveStatsForStudent(student.id);
      const sinceLast = total - (analysis?.attemptCount ?? 0);
      return { student, total, analysis, live, sinceLast };
    })
    // 正答率が低い生徒を上に。まだ回答がない生徒は最後
    .sort((a, b) => (a.live?.stats.accuracy ?? 2) - (b.live?.stats.accuracy ?? 2));

  // 苦戦中(正答率60%未満・20回答以上)と、それ以外の生徒の傾向を比べる
  const measured = rows.filter((row) => row.live && row.total >= ANALYSIS_INTERVAL);
  const struggling = measured.filter((row) => row.live!.stats.accuracy < 0.6);
  const others = measured.filter((row) => row.live!.stats.accuracy >= 0.6);
  const metrics: Array<{ label: string; of: (row: (typeof rows)[number]) => number; format: (v: number) => string }> = [
    { label: "平均反応時間", of: (r) => r.live!.stats.avgResponseTimeMs, format: sec },
    {
      label: "手書き回答の割合",
      of: (r) => r.live!.stats.handwritingTotal / r.live!.stats.total,
      format: pct,
    },
    {
      label: "正解でも反応が遅い問題の割合",
      of: (r) => r.live!.stats.slowCorrectCount / r.live!.stats.total,
      format: pct,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/oral-exam"
        className="flex w-fit items-center gap-1.5 text-body-sm text-slate-400 transition-colors hover:text-ivory-200"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        口頭試問トップに戻る
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-h1 text-ivory-100">
          <LineChart className="size-6 text-gold-400" strokeWidth={1.75} />
          データ分析
        </h1>
        <p className="mt-1 text-body-sm text-slate-400">
          生徒が口頭試問で答えた記録をすべて保存し、{ANALYSIS_INTERVAL}回答ごとに「データ → 特徴 → 分析」を自動で作ります。
          できない生徒のつまずきの原因を探るための画面です。
        </p>
      </div>

      {measured.length >= 2 && struggling.length > 0 && others.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-panel">
          <h2 className="text-h3 text-ivory-100">苦戦中の生徒に共通する傾向</h2>
          <p className="mt-1 text-body-sm text-slate-400">
            正答率60%未満の{struggling.length}名と、それ以外の{others.length}名の平均を比べています(全回答が対象)。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-caption text-slate-500">
                  <th className="py-1 pr-4 font-normal">項目</th>
                  <th className="py-1 pr-4 font-normal">苦戦中</th>
                  <th className="py-1 font-normal">それ以外</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.label} className="border-t border-white/[0.05]">
                    <td className="py-2 pr-4 text-slate-300">{metric.label}</td>
                    <td className="py-2 pr-4 tabular-nums text-ivory-100">{metric.format(average(struggling.map(metric.of)))}</td>
                    <td className="py-2 tabular-nums text-ivory-100">{metric.format(average(others.map(metric.of)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-ivory-100">生徒別の分析</h2>
        {rows.map(({ student, total, analysis, live, sinceLast }) => {
          const narrative = analysis ? (JSON.parse(analysis.analysisJson) as AnalysisNarrative) : null;
          return (
            <Link
              key={student.id}
              href={`/dashboard/oral-exam/analysis/${student.id}`}
              className="rounded-xl border border-border bg-card p-5 shadow-panel transition-colors duration-300 hover:border-gold-500/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body font-medium text-ivory-100">{student.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-caption tabular-nums text-slate-400">
                  {live && <span>正答率 {pct(live.stats.accuracy)}</span>}
                  <span>全{total}回答</span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5">
                    次の分析まで あと{Math.max(ANALYSIS_INTERVAL - sinceLast, 0)}回答
                  </span>
                  <ChevronRight className="size-4 text-gold-400" strokeWidth={1.75} />
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-body-sm text-slate-300">
                {narrative
                  ? narrative.summary
                  : total === 0
                    ? "まだ回答がありません。"
                    : `最初の分析は${ANALYSIS_INTERVAL}回答たまると自動で作られます(いま${total}回答)。`}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
