import { MagnitudeBarList } from "@/components/magnitude-bar-list";
import { demoStudent } from "@/lib/mock-data";
import { ensureSeeded, getSubjectBreakdown, getTopStumbles } from "@/lib/db";
import { getLiveStumbleTotals, getLiveSubjectTotals } from "@/lib/roster";

// SQLiteから毎回最新の実データを読むため、静的レンダリングのキャッシュを無効化する
export const dynamic = "force-dynamic";

export default function AnalysisPage() {
  ensureSeeded(demoStudent.id);
  const liveSubjects = getSubjectBreakdown(demoStudent.id);
  const liveStumbles = getTopStumbles(demoStudent.id);
  const subjectTotals = getLiveSubjectTotals();
  const stumbleTotals = getLiveStumbleTotals();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">弱点分析</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          全生徒の傾向と、実際に質問実績のある生徒の内訳を確認できます。
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">教科別の質問件数</h2>
          <p className="mt-1 mb-5 text-body-sm text-slate-400">
            全生徒・直近14日の合計
          </p>
          <MagnitudeBarList
            items={subjectTotals.map((s) => ({ label: s.subject, value: s.count }))}
            variant="uniform"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <h2 className="text-h3 text-ivory-100">全体のつまずき傾向</h2>
          <p className="mt-1 mb-5 text-body-sm text-slate-400">
            もっとも件数の多いタグを優先課題として提示
          </p>
          <MagnitudeBarList
            items={stumbleTotals.map((s) => ({ label: s.label, value: s.count }))}
            variant="emphasis"
          />
        </div>
      </section>

      <section className="rounded-xl border border-gold-500/20 bg-card p-6 shadow-panel">
        <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
          実データ
        </p>
        <h2 className="mt-1 text-h3 text-ivory-100">
          {demoStudent.name}様の弱点内訳
        </h2>
        <p className="mt-1 mb-5 text-body-sm text-slate-400">
          実際にAIチューターへ送った質問から自動集計しています。
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-body-sm font-medium text-ivory-200">
              教科別
            </p>
            {liveSubjects.length > 0 ? (
              <MagnitudeBarList
                items={liveSubjects.map((s) => ({ label: s.subject, value: s.count }))}
                variant="uniform"
              />
            ) : (
              <p className="text-body-sm text-slate-500">まだ質問がありません。</p>
            )}
          </div>
          <div>
            <p className="mb-3 text-body-sm font-medium text-ivory-200">
              つまずきタグ
            </p>
            {liveStumbles.length > 0 ? (
              <MagnitudeBarList
                items={liveStumbles.map((s) => ({ label: s.label, value: s.count }))}
                variant="emphasis"
              />
            ) : (
              <p className="text-body-sm text-slate-500">まだ質問がありません。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
