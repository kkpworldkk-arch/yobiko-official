"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  Printer,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MagnitudeBarList } from "@/components/magnitude-bar-list";
import { formatRelativeTimeJa } from "@/lib/format";
import type { ProspectAssessment } from "@/lib/types";

const SUPPORT_POINTS = [
  {
    title: "AIチューターによる24時間対応",
    detail: "問題でつまずいた瞬間に質問でき、その場で解法の道筋を示します。",
  },
  {
    title: "専属講師による個別分析",
    detail: "模試データと日々の質問傾向を照らし合わせ、根本原因から対策します。",
  },
  {
    title: "週次の復習計画",
    detail: "優先分野を毎週組み立て直し、限られた時間を最も伸びる分野に集中させます。",
  },
];

export default function ProspectReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [assessment, setAssessment] = useState<ProspectAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/prospects/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => setAssessment(data.assessment))
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <p className="py-16 text-center text-body-sm text-slate-500">
        読み込み中…
      </p>
    );
  }

  if (notFound || !assessment) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-body-sm text-slate-400">診断が見つかりませんでした。</p>
        <Link
          href="/dashboard/prospects"
          className="text-body-sm font-medium text-gold-400 hover:text-gold-300"
        >
          一覧に戻る
        </Link>
      </div>
    );
  }

  const subjectItems = [...assessment.subjects]
    .map((s) => ({
      label: s.subject,
      value: s.fullScore > 0 ? Math.round((s.score / s.fullScore) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.value - b.value);

  const unitItems = [...assessment.units]
    .map((u) => ({ label: `${u.subject}・${u.unit}`, value: 100 - u.correctRate }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/prospects"
          className="flex items-center gap-1.5 text-body-sm text-slate-400 transition-colors hover:text-ivory-200"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          一覧に戻る
        </Link>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.print()}
          className="h-9 gap-1.5 px-3"
        >
          <Printer className="size-3.5" strokeWidth={1.75} />
          印刷する
        </Button>
      </div>

      <section className="rounded-xl border border-gold-500/20 bg-card p-6 shadow-panel-lg sm:p-8">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4 text-gold-400" strokeWidth={1.75} />
          <p className="text-eyebrow uppercase tracking-[0.24em] text-gold-400/90">
            無料弱点診断レポート
          </p>
        </div>
        <h1 className="mt-2.5 text-h1 text-ivory-100">{assessment.name} 様</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          {assessment.grade}・{assessment.targetUniversity}志望
        </p>
        <p className="mt-3 text-caption text-slate-500">
          {assessment.examName}
          {assessment.examDate ? `（${assessment.examDate}）` : ""}
          　診断日: {formatRelativeTimeJa(assessment.createdAt)}
          {assessment.source === "rule-based" && "（デモ診断）"}
        </p>
      </section>

      {(subjectItems.length > 0 || unitItems.length > 0) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {subjectItems.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
              <h2 className="text-h3 text-ivory-100">教科別 得点率</h2>
              <p className="mt-1 mb-5 text-body-sm text-slate-400">
                得点率が低い教科ほど、伸びしろの大きい教科です
              </p>
              <MagnitudeBarList items={subjectItems} variant="uniform" unit="%" />
            </div>
          )}
          {unitItems.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-panel">
              <h2 className="text-h3 text-ivory-100">分野別 誤答傾向</h2>
              <p className="mt-1 mb-5 text-body-sm text-slate-400">
                誤答率が高い分野ほど、優先的に対策すべき分野です
              </p>
              <MagnitudeBarList items={unitItems} variant="emphasis" unit="%" />
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-gold-400" strokeWidth={1.75} />
          <h2 className="text-h2 text-ivory-100">診断コメント</h2>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-body leading-relaxed text-ivory-100">
            {assessment.report.overview}
          </p>
          <p className="text-body leading-relaxed text-slate-200">
            {assessment.report.weaknessDetail}
          </p>
          <p className="text-body leading-relaxed text-slate-200">
            {assessment.report.outlook}
          </p>
        </div>

        {assessment.report.priorityFocus.length > 0 && (
          <div className="mt-6 rounded-lg border border-white/[0.05] bg-navy-800/60 p-4">
            <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
              優先対策分野
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {assessment.report.priorityFocus.map((item) => (
                <li key={item} className="flex items-start gap-2 text-body-sm text-ivory-100">
                  <ClipboardCheck
                    className="mt-0.5 size-3.5 shrink-0 text-gold-400"
                    strokeWidth={1.75}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel sm:p-8">
        <h2 className="text-h2 text-ivory-100">滝原塾でのサポート内容</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SUPPORT_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-4"
            >
              <p className="text-body-sm font-medium text-ivory-100">
                {point.title}
              </p>
              <p className="mt-1.5 text-caption leading-relaxed text-slate-400">
                {point.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
