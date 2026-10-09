"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eraser,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  PenLine,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Volume2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { masteryLevelLabel } from "@/lib/oral-exam-mastery";
import { formatRelativeTimeJa } from "@/lib/format";
import type {
  OralExamAttempt,
  OralExamBook,
  OralExamFilterOptions,
  OralExamInputMode,
  OralExamMastery,
} from "@/lib/types";

interface QueueQuestion {
  id: string;
  category: string;
  prompt: string;
  mastery: OralExamMastery | null;
}

interface AttemptResult {
  attempt: OralExamAttempt;
  source: "claude" | "demo";
  mastery: { level: number; label: string; nextReviewAt: string | null };
  speed: "瞬答" | "標準" | "じっくり";
}

// ブラウザのWeb Speech APIは標準のDOM型定義に含まれないため、最小限の型のみ宣言する
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.98;
  window.speechSynthesis.speak(utterance);
}

// 章リスト（参考書の掲載順）から、開始〜終了の章をまとめて切り出す。未指定なら絞り込まない。
function chapterRange(chapters: string[], start: string, end: string): string[] | undefined {
  if (!start && !end) return undefined;
  const startIndex = start ? chapters.indexOf(start) : 0;
  const endIndex = end ? chapters.indexOf(end) : chapters.length - 1;
  if (startIndex < 0 || endIndex < 0) return undefined;
  return chapters.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
}

interface RangeOption {
  value: string;
  label: string;
}

// 「開始 〜 終了」の2つのプルダウンで範囲を選ぶ。開始だけ選ぶとその1つに絞り、終了を広げて範囲にする。
function RangeSelect({
  label,
  allLabel,
  options,
  start,
  end,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: RangeOption[];
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const indexOf = (value: string) => options.findIndex((option) => option.value === value);
  const labelOf = (value: string | null, placeholder: string) =>
    options.find((option) => option.value === value)?.label ?? placeholder;
  const startIndex = start ? indexOf(start) : 0;
  const endOptions = options.slice(Math.max(startIndex, 0));

  function handleStartChange(value: string | null) {
    if (!value || value === "all") {
      onChange("", "");
      return;
    }
    const keepEnd = end && indexOf(end) >= indexOf(value);
    onChange(value, keepEnd ? end : value);
  }

  function handleEndChange(value: string | null) {
    if (!value) return;
    onChange(start || options[0].value, value);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <Select value={start} onValueChange={(value) => handleStartChange(value as string | null)}>
          <SelectTrigger aria-label={`${label}（開始）`} className="min-w-0 flex-1">
            <SelectValue>{(value: string | null) => labelOf(value, allLabel)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{allLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="shrink-0 text-body-sm text-slate-500">〜</span>
        <Select value={end} onValueChange={(value) => handleEndChange(value as string | null)}>
          <SelectTrigger aria-label={`${label}（終了）`} className="min-w-0 flex-1">
            <SelectValue>{(value: string | null) => labelOf(value, start ? "最後まで" : "—")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {endOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

type Stage = "loading" | "no-books" | "idle" | "active" | "feedback" | "complete" | "all-clear";

export default function OralExamPage() {
  const [books, setBooks] = useState<OralExamBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [filterOptions, setFilterOptions] = useState<Record<string, OralExamFilterOptions>>({});
  const [filters, setFilters] = useState({
    pageStart: "",
    pageEnd: "",
    questionStart: "",
    questionEnd: "",
    chapterStart: "",
    chapterEnd: "",
  });
  const [stage, setStage] = useState<Stage>("loading");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = queue[currentIndex] ?? null;

  const [activeMode, setActiveMode] = useState<OralExamInputMode>("keyboard");
  const [answerText, setAnswerText] = useState("");
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [sessionLog, setSessionLog] = useState<AttemptResult[]>([]);
  const [recentHistory, setRecentHistory] = useState<OralExamAttempt[]>([]);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagComment, setFlagComment] = useState("");
  const [isFlagging, setIsFlagging] = useState(false);
  const [flagDone, setFlagDone] = useState(false);

  const revealTimeRef = useRef<number>(0);

  const loadHistory = useCallback((limit: number) => {
    return fetch(`/api/oral-exam/history?limit=${limit}`)
      .then((res) => res.json())
      .then((data: { attempts: OralExamAttempt[] }) => {
        const list = data.attempts ?? [];
        setRecentHistory(list);
        setHistoryHasMore(list.length >= limit);
      })
      .catch(() => setRecentHistory([]));
  }, []);

  async function loadMoreHistory() {
    setIsLoadingMoreHistory(true);
    const nextLimit = historyLimit + 10;
    await loadHistory(nextLimit);
    setHistoryLimit(nextLimit);
    setIsLoadingMoreHistory(false);
  }

  function toggleHistoryExpanded(id: string) {
    setExpandedAttempts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/oral-exam/books")
      .then((res) => res.json())
      .then((data: { books: OralExamBook[]; filterOptions?: Record<string, OralExamFilterOptions> }) => {
        const list = data.books ?? [];
        setBooks(list);
        setFilterOptions(data.filterOptions ?? {});
        if (list.length > 0) {
          setSelectedBookId(list[0].id);
          setStage("idle");
        } else {
          setStage("no-books");
        }
      })
      .catch(() => setStage("no-books"));

    loadHistory(historyLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function resetAnswerState() {
    setAnswerText("");
    setInterimTranscript("");
    setErrorMessage(null);
    setResult(null);
    setFlagOpen(false);
    setFlagComment("");
    setIsFlagging(false);
    setFlagDone(false);
    if (isRecording) stopRecording();
    if (canvasRef.current) clearCanvas();
  }

  async function submitFlag() {
    if (!currentQuestion || isFlagging) return;
    setIsFlagging(true);
    try {
      await fetch(`/api/oral-exam/questions/${currentQuestion.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: flagComment.trim() || undefined }),
      });
      setFlagDone(true);
      setFlagOpen(false);
    } catch {
      setErrorMessage("報告の送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsFlagging(false);
    }
  }

  function startRecording() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceUnsupported(true);
      return;
    }
    setVoiceUnsupported(false);
    const recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interimChunk += result[0].transcript;
        }
      }
      if (finalChunk) {
        setAnswerText((prev) => `${prev}${finalChunk}`);
      }
      setInterimTranscript(interimChunk);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  const handleCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (!node) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = node.getBoundingClientRect();
    node.width = rect.width * ratio;
    node.height = rect.height * ratio;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#151b2e";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;
    const point = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasDrawing) setHasDrawing(true);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.scale(ratio, ratio);
    setHasDrawing(false);
  }

  async function startSession() {
    if (!selectedBookId) return;
    setStage("loading");
    setSessionLog([]);
    try {
      const res = await fetch("/api/oral-exam/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: selectedBookId,
          filters: {
            pageStart: filters.pageStart ? Number(filters.pageStart) : undefined,
            pageEnd: filters.pageEnd ? Number(filters.pageEnd) : undefined,
            questionStart: filters.questionStart ? Number(filters.questionStart) : undefined,
            questionEnd: filters.questionEnd ? Number(filters.questionEnd) : undefined,
            chapters: chapterRange(filterOptions[selectedBookId]?.chapters ?? [], filters.chapterStart, filters.chapterEnd),
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "口頭試問を開始できませんでした。");
      }
      const data: { session: { id: string }; queue: QueueQuestion[] } = await res.json();
      setSessionId(data.session.id);
      setQueue(data.queue);
      setCurrentIndex(0);
      resetAnswerState();

      if (data.queue.length === 0) {
        setStage("all-clear");
        return;
      }
      revealTimeRef.current = performance.now();
      speak(data.queue[0].prompt);
      setStage("active");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "開始に失敗しました。時間をおいて再度お試しください。");
      setStage("idle");
    }
  }

  const canSubmit =
    activeMode === "handwriting" ? hasDrawing : answerText.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting || !currentQuestion || !sessionId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const responseTimeMs = Math.round(performance.now() - revealTimeRef.current);
    const answerImageDataUrl =
      activeMode === "handwriting" ? canvasRef.current?.toDataURL("image/png") : undefined;

    try {
      const res = await fetch("/api/oral-exam/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          answerText: activeMode === "handwriting" ? "" : answerText,
          answerImageDataUrl,
          inputMode: activeMode,
          responseTimeMs,
        }),
      });

      if (!res.ok) throw new Error("AI採点への問い合わせに失敗しました。");

      const data: AttemptResult = await res.json();
      setResult(data);
      setSessionLog((prev) => [...prev, data]);
      setStage("feedback");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI採点の取得に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function goToNext() {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      setStage("complete");
      return;
    }
    setCurrentIndex(nextIndex);
    resetAnswerState();
    revealTimeRef.current = performance.now();
    speak(queue[nextIndex].prompt);
    setStage("active");
  }

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? null;
  const selectedFilterOptions = filterOptions[selectedBookId];
  const correctCount = sessionLog.filter((r) => r.attempt.isCorrect).length;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="text-eyebrow uppercase tracking-[0.24em] text-gold-400/90">
          AI Oral Examination
        </p>
        <h1 className="mt-2.5 text-h1 text-ivory-100">AI口頭試問</h1>
        <p className="mt-2 text-body-sm text-slate-400">
          参考書を1冊極めるための一問一答ドリルです。音声で問題が読み上げられます。答えられたら
          音声・手書き・キーボードのいずれかで回答してください。反応時間も記録し、無意識に答えられる
          レベルまで定着したかを追跡します。
        </p>
      </section>

      {stage === "loading" && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-gold-400" strokeWidth={1.75} />
        </div>
      )}

      {stage === "no-books" && (
        <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-card py-16 text-center">
          <Sparkles className="size-6 text-slate-500" strokeWidth={1.5} />
          <p className="text-body-sm text-slate-400">
            まだ参考書が割り当てられていません。担当講師が教材を準備するまでお待ちください。
          </p>
        </section>
      )}

      {stage !== "loading" && stage !== "no-books" && books.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-slate-400">参考書を選ぶ</span>
              <Select
                value={selectedBookId}
                onValueChange={(v) => {
                  setSelectedBookId(v as string);
                  setFilters({ pageStart: "", pageEnd: "", questionStart: "", questionEnd: "", chapterStart: "", chapterEnd: "" });
                  setStage("idle");
                }}
              >
                <SelectTrigger className="h-10 w-72">
                  <SelectValue placeholder="参考書を選択">
                    {() => books.find((b) => b.id === selectedBookId)?.title ?? "参考書を選択"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {books.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBook && (
                <span className="text-caption text-slate-500">
                  全{selectedBook.questionCount}問
                  {selectedBook.subject ? `・${selectedBook.subject}` : ""}
                </span>
              )}
            </div>

            {(stage === "idle" || stage === "complete" || stage === "all-clear") && (
              <Button
                type="button"
                onClick={startSession}
                className="h-10 gap-1.5 bg-gold-500 px-5 text-body-sm font-medium text-navy-950 shadow-gold-glow hover:bg-gold-400"
              >
                <Sparkles className="size-4" />
                {stage === "idle" ? "口頭試問を始める" : "もう一度取り組む"}
              </Button>
            )}
          </div>

          <div className="mt-5 border-t border-white/[0.06] pt-5">
            <p className="text-caption text-slate-400">出題範囲</p>
            <div className="mt-2 flex flex-col gap-4">
              {selectedFilterOptions && selectedFilterOptions.pages.length > 0 && (
                <RangeSelect
                  label="ページ"
                  allLabel="全ページ"
                  options={selectedFilterOptions.pages.map((page) => ({ value: String(page), label: `p.${page}` }))}
                  start={filters.pageStart}
                  end={filters.pageEnd}
                  onChange={(pageStart, pageEnd) => setFilters((current) => ({ ...current, pageStart, pageEnd }))}
                />
              )}
              {selectedFilterOptions && selectedFilterOptions.questionCount > 0 && (
                <RangeSelect
                  label="問題番号"
                  allLabel="全問題"
                  options={Array.from({ length: selectedFilterOptions.questionCount }, (_, index) => ({
                    value: String(index + 1),
                    label: `問${index + 1}`,
                  }))}
                  start={filters.questionStart}
                  end={filters.questionEnd}
                  onChange={(questionStart, questionEnd) => setFilters((current) => ({ ...current, questionStart, questionEnd }))}
                />
              )}
              {selectedFilterOptions && selectedFilterOptions.chapters.length > 0 && (
                <RangeSelect
                  label="章・カテゴリ"
                  allLabel="全章・カテゴリ"
                  options={selectedFilterOptions.chapters.map((chapter) => ({ value: chapter, label: chapter }))}
                  start={filters.chapterStart}
                  end={filters.chapterEnd}
                  onChange={(chapterStart, chapterEnd) => setFilters((current) => ({ ...current, chapterStart, chapterEnd }))}
                />
              )}
            </div>
          </div>

          {errorMessage && stage === "idle" && (
            <p className="mt-3 text-caption text-crimson-500">{errorMessage}</p>
          )}

          {stage === "all-clear" && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-sage-500/25 bg-sage-500/[0.06] py-10 text-center">
              <CheckCircle2 className="size-6 text-sage-500" strokeWidth={1.75} />
              <p className="text-body-sm text-slate-200">
                今は復習が必要な問題がありません。よく定着しています。
              </p>
            </div>
          )}

          {stage === "complete" && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-gold-500/25 bg-gold-500/[0.06] py-10 text-center">
              <CheckCircle2 className="size-6 text-gold-400" strokeWidth={1.75} />
              <p className="text-body font-medium text-ivory-100">
                今回のセットが終了しました（正解 {correctCount} / {sessionLog.length}）
              </p>
              <p className="text-caption text-slate-400">
                次回は間隔を空けて、まだ定着していない問題から出題されます。
              </p>
            </div>
          )}

          {(stage === "active" || stage === "feedback") && currentQuestion && (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-2 text-caption text-slate-500">
                <span>
                  {currentIndex + 1} / {queue.length} 問
                </span>
                <span>
                  現在の習熟度:{" "}
                  <span className="font-medium text-gold-400">
                    {masteryLevelLabel(currentQuestion.mastery?.level ?? 0)}
                  </span>
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-white/[0.05] bg-navy-800/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{currentQuestion.category || "総合"}</Badge>
                  <div className="flex items-center gap-1.5">
                    {!flagDone && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setFlagOpen((v) => !v)}
                        className="h-8 gap-1.5 px-2.5 text-caption text-amber-300"
                      >
                        <TriangleAlert className="size-3.5" strokeWidth={1.75} />
                        この問題はおかしい
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => speak(currentQuestion.prompt)}
                      className="h-8 gap-1.5 px-2.5 text-caption"
                    >
                      <Volume2 className="size-3.5" strokeWidth={1.75} />
                      読み上げ
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-body leading-relaxed text-ivory-100">
                  {currentQuestion.prompt}
                </p>

                {flagOpen && !flagDone && (
                  <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                    <p className="text-caption text-amber-300">
                      この問題を講師に報告します。報告すると、この問題は今後出題されなくなります。
                    </p>
                    <Textarea
                      value={flagComment}
                      onChange={(event) => setFlagComment(event.target.value)}
                      placeholder="どこがおかしいか（任意）"
                      className="mt-2 min-h-16 text-body-sm"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setFlagOpen(false)}
                        className="h-8 px-3 text-caption"
                      >
                        キャンセル
                      </Button>
                      <Button
                        type="button"
                        onClick={submitFlag}
                        disabled={isFlagging}
                        className="h-8 px-3 text-caption"
                      >
                        {isFlagging ? (
                          <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                        ) : (
                          "報告する"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {flagDone && (
                  <p className="mt-3 flex items-center gap-1.5 text-caption text-amber-300">
                    <CheckCircle2 className="size-3.5" strokeWidth={1.75} />
                    報告しました。この問題は今後出題されません。
                  </p>
                )}
              </div>

              {stage === "active" && (
                <>
                  <Separator className="my-5" />

                  <Tabs
                    value={activeMode}
                    onValueChange={(value) => {
                      if (isRecording) stopRecording();
                      setActiveMode(value as OralExamInputMode);
                    }}
                  >
                    <TabsList className="mb-4 grid w-full grid-cols-3">
                      <TabsTrigger value="keyboard">
                        <Keyboard className="size-3.5" strokeWidth={1.75} />
                        キーボード
                      </TabsTrigger>
                      <TabsTrigger value="voice">
                        <Mic className="size-3.5" strokeWidth={1.75} />
                        音声入力
                      </TabsTrigger>
                      <TabsTrigger value="handwriting">
                        <PenLine className="size-3.5" strokeWidth={1.75} />
                        手書き
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="keyboard">
                      <Textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="回答をキーボードで入力してください。"
                        rows={5}
                        className="resize-none"
                      />
                    </TabsContent>

                    <TabsContent value="voice">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant={isRecording ? "destructive" : "secondary"}
                            onClick={isRecording ? stopRecording : startRecording}
                            className="h-10 gap-1.5 px-4"
                          >
                            {isRecording ? (
                              <>
                                <MicOff className="size-4" />
                                録音を終了
                              </>
                            ) : (
                              <>
                                <Mic className="size-4" />
                                録音を開始
                              </>
                            )}
                          </Button>
                          {isRecording && (
                            <span className="inline-flex items-center gap-1.5 text-caption text-gold-400">
                              <span className="size-1.5 animate-pulse rounded-full bg-gold-400" />
                              聞き取り中…
                            </span>
                          )}
                        </div>
                        {voiceUnsupported && (
                          <p className="text-caption text-slate-500">
                            お使いのブラウザは音声入力に対応していません。キーボードでの入力をご利用ください。
                          </p>
                        )}
                        {interimTranscript && (
                          <p className="text-caption text-slate-500">{interimTranscript}</p>
                        )}
                        <Textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="話した内容がここに文字として入力されます。必要に応じて編集してください。"
                          rows={5}
                          className="resize-none"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="handwriting">
                      <div className="flex flex-col gap-3">
                        <canvas
                          ref={handleCanvasRef}
                          onPointerDown={handlePointerDown}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerLeave={handlePointerUp}
                          className="h-56 w-full touch-none rounded-lg border border-white/10"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={clearCanvas}
                          className="h-9 w-fit gap-1.5 px-3"
                        >
                          <Eraser className="size-3.5" strokeWidth={1.75} />
                          消して書き直す
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {errorMessage && (
                    <p className="mt-3 text-caption text-crimson-500">{errorMessage}</p>
                  )}

                  <Button
                    type="button"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmit}
                    className="mt-5 h-11 w-full bg-gold-500 text-body font-medium text-navy-950 shadow-gold-glow transition-all duration-400 ease-luxury hover:bg-gold-400 disabled:opacity-60 sm:w-auto sm:px-6"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        AIが採点しています…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        回答する
                      </>
                    )}
                  </Button>
                </>
              )}

              {stage === "feedback" && result && (
                <div className="mt-5 flex flex-col gap-4">
                  <div
                    className={
                      result.attempt.isCorrect
                        ? "flex items-center gap-2 rounded-lg border border-sage-500/25 bg-sage-500/[0.08] px-4 py-3"
                        : "flex items-center gap-2 rounded-lg border border-crimson-500/25 bg-crimson-500/[0.08] px-4 py-3"
                    }
                  >
                    {result.attempt.isCorrect ? (
                      <CheckCircle2 className="size-4 text-sage-500" strokeWidth={1.75} />
                    ) : (
                      <XCircle className="size-4 text-crimson-500" strokeWidth={1.75} />
                    )}
                    <span className="text-body-sm font-medium text-ivory-100">
                      {result.attempt.isCorrect ? "正解" : "要復習"}
                    </span>
                    <span className="ml-auto text-caption text-slate-400">
                      反応速度: {result.speed}（{Math.round(result.attempt.responseTimeMs / 100) / 10}秒）
                    </span>
                    <Badge variant="outline">習熟度: {result.mastery.label}</Badge>
                  </div>

                  <p className="text-body leading-relaxed text-ivory-100">
                    {result.attempt.evaluation}
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3.5">
                      <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                        良かった点
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {result.attempt.strengths.map((item) => (
                          <li key={item} className="text-body-sm text-slate-200">
                            ・{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-navy-800/60 p-3.5">
                      <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                        改善点
                      </p>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {result.attempt.improvements.map((item) => (
                          <li key={item} className="text-body-sm text-slate-200">
                            ・{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {result.source === "demo" && (
                    <span className="text-caption text-slate-500">
                      （デモ採点 — APIキー未設定）
                    </span>
                  )}

                  <Button
                    type="button"
                    onClick={goToNext}
                    className="h-11 w-full gap-1.5 bg-gold-500 text-body font-medium text-navy-950 shadow-gold-glow hover:bg-gold-400 sm:w-auto sm:px-6"
                  >
                    {currentIndex + 1 >= queue.length ? "結果を見る" : "次の問題へ"}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {sessionLog.length > 0 && (
        <section>
          <h2 className="mb-4 text-h2 text-ivory-100">今回の記録</h2>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-6 shadow-panel">
            {sessionLog.map((r) => (
              <div
                key={r.attempt.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-4 last:pb-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {r.attempt.isCorrect ? (
                    <CheckCircle2 className="size-4 shrink-0 text-sage-500" strokeWidth={1.75} />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-crimson-500" strokeWidth={1.75} />
                  )}
                  <p className="truncate text-body-sm text-ivory-200">
                    {r.attempt.questionPrompt}
                  </p>
                </div>
                <span className="shrink-0 text-caption text-slate-500">{r.speed}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {recentHistory.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <RotateCcw className="size-4 text-gold-400" strokeWidth={1.75} />
            <h2 className="text-h2 text-ivory-100">これまでの記録</h2>
          </div>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-6 shadow-panel">
            {recentHistory.map((entry) => {
              const isExpanded = expandedAttempts.has(entry.id);
              return (
                <div key={entry.id} className="py-3 first:pt-4 last:pb-4">
                  <button
                    type="button"
                    onClick={() => toggleHistoryExpanded(entry.id)}
                    className="flex w-full flex-col gap-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
                        {entry.bookTitle}
                        {entry.category ? ` ・ ${entry.category}` : ""}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-caption text-slate-500">
                          {formatRelativeTimeJa(entry.createdAt)}
                        </span>
                        <ChevronDown
                          className={`size-3.5 text-slate-500 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          strokeWidth={1.75}
                        />
                      </div>
                    </div>
                    <p
                      className={
                        isExpanded
                          ? "text-body-sm text-ivory-200"
                          : "truncate text-body-sm text-ivory-200"
                      }
                    >
                      {entry.questionPrompt}
                    </p>
                    <div className="flex items-center gap-2 text-caption text-slate-500">
                      {entry.isCorrect ? (
                        <span className="text-sage-500">正解</span>
                      ) : (
                        <span className="text-crimson-500">要復習</span>
                      )}
                      <span>習熟度: {masteryLevelLabel(entry.masteryLevel)}</span>
                      {!isExpanded && entry.teacherComment && (
                        <span className="truncate text-gold-400">
                          講師コメント: {entry.teacherComment}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-white/[0.05] bg-navy-800/60 p-3.5">
                      {entry.answerText && (
                        <p className="text-body-sm text-slate-300">
                          あなたの回答: {entry.answerText}
                        </p>
                      )}
                      {entry.answerImageDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.answerImageDataUrl}
                          alt="手書き回答"
                          className="h-28 w-auto rounded-lg border border-white/10 bg-ivory-100"
                        />
                      )}
                      {entry.evaluation && (
                        <p className="text-body-sm leading-relaxed text-ivory-200">
                          {entry.evaluation}
                        </p>
                      )}
                      {(entry.strengths.length > 0 || entry.improvements.length > 0) && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {entry.strengths.length > 0 && (
                            <div>
                              <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                                良かった点
                              </p>
                              <ul className="mt-1.5 flex flex-col gap-1">
                                {entry.strengths.map((item) => (
                                  <li key={item} className="text-caption text-slate-300">
                                    ・{item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {entry.improvements.length > 0 && (
                            <div>
                              <p className="text-eyebrow uppercase tracking-[0.16em] text-gold-400/80">
                                改善点
                              </p>
                              <ul className="mt-1.5 flex flex-col gap-1">
                                {entry.improvements.map((item) => (
                                  <li key={item} className="text-caption text-slate-300">
                                    ・{item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      {entry.teacherComment && (
                        <p className="text-caption text-gold-400">
                          講師コメント: {entry.teacherComment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {historyHasMore && (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={loadMoreHistory}
                disabled={isLoadingMoreHistory}
                className="h-9 px-4 text-caption"
              >
                {isLoadingMoreHistory ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  "もっと見る"
                )}
              </Button>
            </div>
          )}
        </section>
      )}

      {errorMessage && stage !== "active" && stage !== "idle" && (
        <div className="flex items-center gap-2 rounded-lg border border-crimson-500/25 bg-crimson-500/[0.06] px-4 py-3">
          <TriangleAlert className="size-4 text-crimson-500" strokeWidth={1.75} />
          <p className="text-body-sm text-slate-300">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
