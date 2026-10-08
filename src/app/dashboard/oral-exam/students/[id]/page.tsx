import Link from "next/link";
import { notFound as nextNotFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { MagnitudeBarList } from "@/components/magnitude-bar-list";
import { AttemptCommentEditor } from "@/components/oral-exam/attempt-comment-editor";
import {
  getAssignedBooksForStudent,
  getMasteryForBook,
  getOralExamAttempts,
  getOralExamInsight,
  getOralExamQuestions,
  getOralExamStudentSummary,
  saveOralExamInsight,
} from "@/lib/db";
import { generateOralExamInsight } from "@/lib/oral-exam-insight";
import { getRoster } from "@/lib/roster";
import { MASTERY_LEVEL_LABELS } from "@/lib/oral-exam-mastery";
import { formatRelativeTimeJa } from "@/lib/format";

export const dynamic = "force-dynamic";

const DEFAULT_ATTEMPT_LIMIT = 40;
const ATTEMPT_LIMIT_STEP = 40;

export default async function OralExamStudentProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { id } = await params;
  const { limit: limitParam } = await searchParams;
  const student = getRoster().find((s) => s.id === id);
  if (!student) {
    nextNotFound();
  }

  const parsedLimit = limitParam ? Number(limitParam) : NaN;
  const attemptLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.floor(parsedLimit) : DEFAULT_ATTEMPT_LIMIT;

  const assignedBooks = getAssignedBooksForStudent(id);
  const summary = getOralExamStudentSummary(id);
  const attempts = getOralExamAttempts(id, { limit: attemptLimit });
  const hasMoreAttempts = attempts.length >= attemptLimit;

  // 新しい回答が増えた時だけAIで要約を作り直す(キャッシュがあり件数が変わっていなければ
  // 再利用する。講師がページを開くたびに課金・待ち時間が発生しないようにするため)。
  let insight = getOralExamInsight(id);
  if (summary.totalAttempts > 0 && insight?.attemptCount !== summary.totalAttempts) {
    const generated = await generateOralExamInsight({
      studentName: student.name,
      totalQuestions: summary.totalQuestions,
      masteredCount: summary.masteredCount,
      dueCount: summary.dueCount,
      totalAttempts: summary.totalAttempts,
      recentAttempts: attempts,
    });
    if (generated) {
      saveOralExamInsight(id, generated, summary.totalAttempts);
      insight = { summary: generated, generatedAt: new Date().toISOString(), attemptCount: summary.totalAttempts };
    }
  }

  const levelCounts = new Array(MASTERY_LEVEL_LABELS.length).fill(0);
  for (const book of assignedBooks) {
    const questions = getOralExamQuestions(book.id);
    const masteryRows = getMasteryForBook(id, book.id);
    const byQuestion = new Map(masteryRows.map((m) => [m.questionId, m]));
    for (const question of questions) {
      const mastery = byQuestion.get(question.id);
      levelCounts[mastery?.level ?? 0] += 1;
    }
  }

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
        <h1 className="text-h1 text-ivory-100">{student.name} 様の口頭試問状況</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          {assignedBooks.length > 0
            ? `割り当て中: ${assignedBooks.map((b) => b.title).join("、")}`
            : "まだ参考書が割り当てられていません。"}
        </p>
      </div>

      {insight && (
        <section className="rounded-xl border border-gold-400/30 bg-card p-5 shadow-panel">
          <h2 className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
            AIによる要約・アドバイス
          </h2>
          <p className="mt-2 whitespace-pre-line text-body-sm leading-relaxed text-ivory-200">
            {insight.summary}
          </p>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <p className="text-caption text-slate-500">総問題数</p>
          <p className="mt-1 text-h2 tabular-nums text-ivory-100">{summary.totalQuestions}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <p className="text-caption text-slate-500">習得済み</p>
          <p className="mt-1 text-h2 tabular-nums text-sage-500">{summary.masteredCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <p className="text-caption text-slate-500">復習待ち</p>
          <p className="mt-1 text-h2 tabular-nums text-gold-400">{summary.dueCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <p className="text-caption text-slate-500">平均反応時間</p>
          <p className="mt-1 flex items-center gap-1 text-h2 tabular-nums text-ivory-100">
            <Clock3 className="size-4 text-slate-500" strokeWidth={1.75} />
            {summary.avgResponseTimeMs != null
              ? `${Math.round(summary.avgResponseTimeMs / 100) / 10}秒`
              : "—"}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">習熟度の内訳</h2>
        <p className="mt-1 mb-5 text-body-sm text-slate-400">
          レベルが上がるほど正解が続いており、無意識に答えられる状態に近づいています。
        </p>
        <MagnitudeBarList
          items={MASTERY_LEVEL_LABELS.map((label, i) => ({ label, value: levelCounts[i] }))}
          variant="uniform"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">回答履歴</h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {attempts.length === 0 && (
            <p className="py-6 text-center text-body-sm text-slate-500">まだ回答がありません。</p>
          )}
          {attempts.map((attempt) => (
            <div key={attempt.id} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
                  {attempt.bookTitle}
                  {attempt.category ? ` ・ ${attempt.category}` : ""}
                </span>
                <span className="text-caption text-slate-500">
                  {formatRelativeTimeJa(attempt.createdAt)}
                </span>
              </div>
              <p className="text-body-sm text-ivory-200">{attempt.questionPrompt}</p>
              {attempt.answerText && (
                <p className="text-caption text-slate-400">回答: {attempt.answerText}</p>
              )}
              {attempt.answerImageDataUrl && (
                <a
                  href={attempt.answerImageDataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attempt.answerImageDataUrl}
                    alt="手書き回答"
                    className="mt-1 h-24 w-auto rounded-lg border border-white/10 bg-ivory-100"
                  />
                </a>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-slate-500">
                {attempt.isCorrect ? (
                  <span className="flex items-center gap-1 text-sage-500">
                    <CheckCircle2 className="size-3.5" strokeWidth={1.75} />
                    正解
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-crimson-500">
                    <XCircle className="size-3.5" strokeWidth={1.75} />
                    要復習
                  </span>
                )}
                <span>反応 {Math.round(attempt.responseTimeMs / 100) / 10}秒</span>
                <span>習熟度: {MASTERY_LEVEL_LABELS[attempt.masteryLevel]}</span>
                <span>入力方法: {attempt.inputMode === "voice" ? "音声" : attempt.inputMode === "handwriting" ? "手書き" : "キーボード"}</span>
                {attempt.feedbackSource === "demo" && <span>（デモ採点）</span>}
              </div>
              {attempt.evaluation && (
                <p className="mt-0.5 text-caption leading-relaxed text-slate-300">
                  AI評価: {attempt.evaluation}
                </p>
              )}
              {(attempt.strengths.length > 0 || attempt.improvements.length > 0) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {attempt.strengths.length > 0 && (
                    <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3">
                      <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                        良かった点
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {attempt.strengths.map((item) => (
                          <li key={item} className="text-caption text-slate-300">
                            ・{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {attempt.improvements.length > 0 && (
                    <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3">
                      <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                        改善点
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {attempt.improvements.map((item) => (
                          <li key={item} className="text-caption text-slate-300">
                            ・{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <AttemptCommentEditor attemptId={attempt.id} initialComment={attempt.teacherComment} />
            </div>
          ))}
        </div>

        {hasMoreAttempts && (
          <div className="mt-4 flex justify-center">
            <Link
              href={`/dashboard/oral-exam/students/${id}?limit=${attemptLimit + ATTEMPT_LIMIT_STEP}`}
              className="rounded-lg border border-border px-4 py-2 text-caption text-slate-300 transition-colors hover:text-ivory-100"
            >
              もっと見る
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
