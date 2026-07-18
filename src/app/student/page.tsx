"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  Clock3,
  Loader2,
  MessagesSquare,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/stat-tile";
import { demoStudent } from "@/lib/mock-data";
import { formatRelativeTimeJa } from "@/lib/format";
import type { QaHistoryEntry, TutorResponse } from "@/lib/types";

const SUBJECTS = ["数学", "英語", "化学", "生物", "物理"];

export default function StudentPage() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [unit, setUnit] = useState("");
  const [question, setQuestion] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [responseSource, setResponseSource] = useState<"claude" | "demo" | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<QaHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tutor?studentId=${demoStudent.id}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setIsHistoryLoading(false));
  }, []);

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || isThinking) return;

    setIsThinking(true);
    setResponse(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: demoStudent.id,
          subject,
          unit,
          question,
        }),
      });

      if (!res.ok) {
        throw new Error("AIチューターへの問い合わせに失敗しました。");
      }

      const data: { entry: QaHistoryEntry; source: "claude" | "demo" } =
        await res.json();

      setResponse(data.entry);
      setResponseSource(data.source);
      setHistory((prev) => [data.entry, ...prev]);
    } catch {
      setErrorMessage(
        "AIチューターへの問い合わせに失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="text-center sm:text-left">
        <p className="text-eyebrow uppercase tracking-[0.24em] text-gold-400/90">
          AI Concierge Tutor
        </p>
        <h1 className="mt-2.5 text-h1 text-ivory-100">
          ようこそ、{demoStudent.name}様
        </h1>
        <p className="mt-2 text-body-sm text-slate-400">
          {demoStudent.grade}・{demoStudent.targetUniversity}志望
          — デモアカウントとして生徒体験をご覧いただいています。
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="総質問数"
          value={`${demoStudent.totalQuestions}`}
          icon={MessagesSquare}
        />
        <StatTile
          label="直近14日"
          value={`${demoStudent.questionsLast14Days}`}
          icon={Clock3}
        />
        <StatTile
          label="対応中の弱点"
          value={`${demoStudent.topStumbles.length}`}
          icon={BarChart3}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h2 text-ivory-100">AIに質問する</h2>
        <p className="mt-1 text-body-sm text-slate-400">
          問題文や分からない箇所を入力すると、AIがすぐに解説します。
        </p>

        <form onSubmit={handleAsk} className="mt-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,10rem)_1fr]">
            <Select value={subject} onValueChange={(v) => setSubject(v as string)}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="教科" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="単元（例: 確率、構文、有機化学）"
              className="h-11"
            />
          </div>

          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="問題文、途中式、分からない箇所を入力してください。"
            rows={5}
            className="resize-none"
          />

          <Button
            type="submit"
            disabled={!question.trim() || isThinking}
            className="h-11 w-full bg-gold-500 text-body font-medium text-navy-950 shadow-gold-glow transition-all duration-400 ease-luxury hover:bg-gold-400 disabled:opacity-60 sm:w-auto sm:self-end sm:px-6"
          >
            {isThinking ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                考えています…
              </>
            ) : (
              <>
                <Send className="size-4" />
                AIに質問する
              </>
            )}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold-400" strokeWidth={1.75} />
            <h2 className="text-h2 text-ivory-100">AIからの解説</h2>
          </div>
          {response && responseSource === "demo" && (
            <span className="text-caption text-slate-500">
              （デモ応答 — APIキー未設定）
            </span>
          )}
        </div>

        {errorMessage && !isThinking && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-crimson-500/25 bg-crimson-500/[0.06] py-10 text-center">
            <TriangleAlert className="size-6 text-crimson-500" strokeWidth={1.75} />
            <p className="text-body-sm text-slate-300">{errorMessage}</p>
          </div>
        )}

        {!response && !isThinking && !errorMessage && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-10 text-center">
            <MessagesSquare className="size-6 text-slate-500" strokeWidth={1.5} />
            <p className="text-body-sm text-slate-400">
              質問を送ると、ここにAIの解説が表示されます。
            </p>
          </div>
        )}

        {isThinking && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-gold-400" strokeWidth={1.75} />
            <p className="text-body-sm text-slate-400">
              問題を読み解いています…
            </p>
          </div>
        )}

        {response && !isThinking && !errorMessage && (
          <div className="flex flex-col gap-5">
            <p className="text-body leading-relaxed text-ivory-100">
              {response.summary}
            </p>

            <ol className="flex flex-col gap-2.5">
              {response.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-caption font-medium text-gold-400">
                    {index + 1}
                  </span>
                  <span className="text-body-sm text-slate-200">{step}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3.5">
              <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                弱点タグ
              </p>
              <p className="mt-1.5 text-body-sm font-medium text-ivory-100">
                {response.weaknessTag}
              </p>
              <p className="mt-2 text-body-sm leading-relaxed text-slate-300">
                {response.reviewSuggestion}
              </p>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-h2 text-ivory-100">最近の質問</h2>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-6 shadow-panel">
          {isHistoryLoading && (
            <p className="py-8 text-center text-body-sm text-slate-500">
              読み込み中…
            </p>
          )}
          {!isHistoryLoading && history.length === 0 && (
            <p className="py-8 text-center text-body-sm text-slate-500">
              まだ質問履歴がありません。
            </p>
          )}
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-1.5 py-4 first:pt-5 last:pb-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
                  {entry.subject}
                  {entry.unit && entry.unit !== entry.subject
                    ? ` ・ ${entry.unit}`
                    : ""}
                </span>
                <span className="shrink-0 text-caption text-slate-500">
                  {formatRelativeTimeJa(entry.askedAt)}
                </span>
              </div>
              <p className="text-body-sm text-ivory-200">{entry.question}</p>
              <p className="text-caption text-slate-500">
                弱点タグ: {entry.weaknessTag}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
