"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  BarChart3,
  Clock3,
  Download,
  FileText,
  ListChecks,
  Loader2,
  MessagesSquare,
  Paperclip,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/stat-tile";
import { logout } from "@/app/actions/auth";
import { SUBJECTS, UNIVERSITIES } from "@/lib/mock-data";
import { formatRelativeTimeJa } from "@/lib/format";
import { suggestWeaknessTags } from "@/lib/tag-suggest";
import { buildWeeklyPlan } from "@/lib/weekly-plan";
import { downloadHistoryCsv } from "@/lib/csv-export";
import { countWithinDays } from "@/lib/stats";
import type {
  AnswerStatus,
  Attachment,
  Confidence,
  Difficulty,
  QaHistoryEntry,
  QuestionFormat,
  TutorResponse,
} from "@/lib/types";

const DIFFICULTIES: Difficulty[] = ["基礎", "標準", "やや難", "難"];
const FORMATS: QuestionFormat[] = [
  "普段の問題",
  "過去問",
  "予想問題",
  "模試",
  "教材",
];
const ANSWER_STATUSES: AnswerStatus[] = [
  "未着手",
  "途中まで解いた",
  "解いたが不正解",
  "解けたが不安",
  "復習完了",
];
const CONFIDENCES: Confidence[] = ["低", "中", "高"];

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface StudentTutorClientProps {
  studentId: string;
  studentName: string;
  studentGrade: string;
  studentTargetUniversity: string;
  isDemo: boolean;
}

export function StudentTutorClient({
  studentId,
  studentName,
  studentGrade,
  studentTargetUniversity,
  isDemo,
}: StudentTutorClientProps) {
  // 分類
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [unit, setUnit] = useState("");
  const [university, setUniversity] = useState(studentTargetUniversity);
  const [year, setYear] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("標準");
  const [format, setFormat] = useState<QuestionFormat>("普段の問題");

  // 質問本体
  const [question, setQuestion] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // 生徒の状況
  const [studentAttempt, setStudentAttempt] = useState("");
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>("未着手");
  const [confidence, setConfidence] = useState<Confidence>("中");
  const [weaknessHint, setWeaknessHint] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [teacherCheckNeeded, setTeacherCheckNeeded] = useState(false);

  // 送信・応答
  const [isThinking, setIsThinking] = useState(false);
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [responseSource, setResponseSource] = useState<"claude" | "demo" | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 履歴
  const [history, setHistory] = useState<QaHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [historySubjectFilter, setHistorySubjectFilter] = useState("");

  useEffect(() => {
    fetch(`/api/tutor?studentId=${studentId}`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setIsHistoryLoading(false));
  }, [studentId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const accepted: Attachment[] = [];
    let error: string | null = null;

    for (const file of files) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        error = `添付は${MAX_ATTACHMENTS}件までです。`;
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        error = `${file.name} は4MBを超えているため添付できません。`;
        continue;
      }
      accepted.push({ name: file.name, dataUrl: await readFileAsDataUrl(file) });
    }

    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
    }
    setAttachmentError(error);
  }

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  function handleSuggestTags() {
    setTagSuggestions(suggestWeaknessTags(subject, unit, question));
  }

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
          studentId,
          subject,
          unit,
          question,
          university,
          year,
          difficulty,
          format,
          inputType: attachments.length > 0 ? "写真" : "テキスト",
          studentAttempt,
          answerStatus,
          confidence,
          weaknessHint,
          teacherCheckNeeded,
          attachments,
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

      // 質問固有の項目のみリセットし、分類系はそのまま残す
      setUnit("");
      setQuestion("");
      setStudentAttempt("");
      setAnswerStatus("未着手");
      setConfidence("中");
      setWeaknessHint("");
      setTagSuggestions([]);
      setTeacherCheckNeeded(false);
      setAttachments([]);
    } catch {
      setErrorMessage(
        "AIチューターへの問い合わせに失敗しました。時間をおいて再度お試しください。",
      );
    } finally {
      setIsThinking(false);
    }
  }

  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      if (historySubjectFilter && entry.subject !== historySubjectFilter) {
        return false;
      }
      if (!historySearch.trim()) return true;
      const haystack = [
        entry.subject,
        entry.unit,
        entry.question,
        entry.weaknessTag,
        entry.university,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(historySearch.trim().toLowerCase());
    });
  }, [history, historySearch, historySubjectFilter]);

  const weeklyPlan = useMemo(() => buildWeeklyPlan(history), [history]);
  const uniqueWeaknessCount = useMemo(
    () => new Set(history.map((entry) => entry.weaknessTag)).size,
    [history],
  );
  const last14DaysCount = useMemo(
    () => countWithinDays(history.map((entry) => entry.askedAt), 14),
    [history],
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div>
          <p className="text-eyebrow uppercase tracking-[0.24em] text-gold-400/90">
            AI Concierge Tutor
          </p>
          <h1 className="mt-2.5 text-h1 text-ivory-100">
            ようこそ、{studentName}様
          </h1>
          <p className="mt-2 text-body-sm text-slate-400">
            {studentGrade}・{studentTargetUniversity}志望
            {isDemo && " — デモアカウントとして生徒体験をご覧いただいています。"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void logout();
          }}
          className="shrink-0 text-caption text-slate-400 transition-colors duration-300 hover:text-gold-400"
        >
          ログアウト
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="総質問数"
          value={`${history.length}`}
          icon={MessagesSquare}
        />
        <StatTile
          label="直近14日"
          value={`${last14DaysCount}`}
          icon={Clock3}
        />
        <StatTile
          label="対応中の弱点"
          value={`${uniqueWeaknessCount}`}
          icon={BarChart3}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h2 text-ivory-100">AIに質問する</h2>
        <p className="mt-1 text-body-sm text-slate-400">
          問題文や分からない箇所を入力すると、AIがすぐに解説します。
        </p>

        <form onSubmit={handleAsk} className="mt-5 flex flex-col gap-5">
          <div>
            <p className="mb-2.5 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
              分類
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Input
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                list="universitySuggestions"
                placeholder="志望大学（任意）"
                className="h-11"
              />
              <datalist id="universitySuggestions">
                {UNIVERSITIES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="年度（例: 2026、任意）"
                className="h-11"
              />
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as Difficulty)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="難度" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={format} onValueChange={(v) => setFormat(v as QuestionFormat)}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="問題形式" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2.5 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
              質問
            </p>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="問題文、途中式、分からない箇所を入力してください。"
              rows={5}
              className="resize-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor="attachmentInput"
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-body-sm text-slate-300 transition-colors duration-300 hover:border-gold-500/30 hover:text-ivory-200"
              >
                <Paperclip className="size-3.5" strokeWidth={1.75} />
                画像・PDFを添付
              </label>
              <input
                id="attachmentInput"
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              {attachments.map((file) => (
                <span
                  key={file.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-navy-800/60 py-1 pl-2.5 pr-1.5 text-caption text-slate-300"
                >
                  <FileText className="size-3.5 text-slate-400" strokeWidth={1.75} />
                  {file.name}
                  <button
                    type="button"
                    onClick={() => removeAttachment(file.name)}
                    aria-label={`${file.name}を削除`}
                    className="flex size-4 items-center justify-center rounded-full text-slate-500 hover:text-ivory-200"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            {attachmentError && (
              <p className="mt-1.5 text-caption text-crimson-500">
                {attachmentError}
              </p>
            )}
          </div>

          <Separator />

          <div>
            <p className="mb-2.5 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
              生徒の状況
            </p>
            <Textarea
              value={studentAttempt}
              onChange={(e) => setStudentAttempt(e.target.value)}
              placeholder="どこまで解けたか、どこで止まったかを残します（任意）。"
              rows={3}
              className="resize-none"
            />
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                value={answerStatus}
                onValueChange={(v) => setAnswerStatus(v as AnswerStatus)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="解答状況" />
                </SelectTrigger>
                <SelectContent>
                  {ANSWER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={confidence}
                onValueChange={(v) => setConfidence(v as Confidence)}
              >
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="確信度" />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  value={weaknessHint}
                  onChange={(e) => setWeaknessHint(e.target.value)}
                  placeholder="弱点タグの候補（任意・AIの参考情報になります）"
                  className="h-10"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSuggestTags}
                  className="h-10 shrink-0 px-3"
                >
                  候補
                </Button>
              </div>
              {tagSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tagSuggestions.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      render={
                        <button
                          type="button"
                          onClick={() => setWeaknessHint(tag)}
                        />
                      }
                      className="cursor-pointer hover:border-gold-500/40 hover:text-gold-400"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <label className="mt-3 flex items-center gap-2.5 text-body-sm text-slate-300">
              <input
                type="checkbox"
                checked={teacherCheckNeeded}
                onChange={(e) => setTeacherCheckNeeded(e.target.checked)}
                className="size-4 rounded border-border accent-gold-500"
              />
              講師確認が必要
            </label>
          </div>

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

      {weeklyPlan.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="size-4 text-gold-400" strokeWidth={1.75} />
            <h2 className="text-h2 text-ivory-100">週次復習メニュー</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {weeklyPlan.map((bucket) => (
              <div
                key={bucket.label}
                className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3.5"
              >
                <p className="text-body-sm font-medium text-ivory-100">
                  {bucket.label}
                </p>
                <p className="mt-0.5 text-caption text-slate-500">
                  {bucket.description}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {bucket.entries.map((entry) => (
                    <li key={entry.id} className="text-caption text-slate-300">
                      <span className="text-gold-400/80">{entry.subject}</span>
                      {" ・ "}
                      {entry.weaknessTag}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2 text-ivory-100">最近の質問</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="教科・単元・タグで検索"
                className="h-9 w-56 rounded-lg border border-border bg-navy-800/60 pl-8 pr-3 text-body-sm text-ivory-100 placeholder:text-slate-500 outline-none transition-colors duration-300 focus:border-gold-500/40"
              />
            </div>
            <Select
              value={historySubjectFilter || "all"}
              onValueChange={(v) =>
                setHistorySubjectFilter(v === "all" ? "" : (v as string))
              }
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="教科" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              disabled={history.length === 0}
              onClick={() =>
                downloadHistoryCsv(history, `質問履歴_${studentName}.csv`)
              }
              className="h-9 gap-1.5 px-3"
            >
              <Download className="size-3.5" strokeWidth={1.75} />
              書き出す
            </Button>
          </div>
        </div>

        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-6 shadow-panel">
          {isHistoryLoading && (
            <p className="py-8 text-center text-body-sm text-slate-500">
              読み込み中…
            </p>
          )}
          {!isHistoryLoading && filteredHistory.length === 0 && (
            <p className="py-8 text-center text-body-sm text-slate-500">
              {history.length === 0
                ? "まだ質問履歴がありません。"
                : "条件に一致する質問がありません。"}
            </p>
          )}
          {filteredHistory.map((entry) => (
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-slate-500">
                <span>弱点タグ: {entry.weaknessTag}</span>
                {entry.attachments.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3" strokeWidth={1.75} />
                    添付{entry.attachments.length}件
                  </span>
                )}
                {entry.teacherCheckNeeded && (
                  <span
                    className={
                      entry.teacherCheckResolved
                        ? "text-sage-500"
                        : "text-crimson-500"
                    }
                  >
                    講師確認: {entry.teacherCheckResolved ? "対応済み" : "未対応"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
