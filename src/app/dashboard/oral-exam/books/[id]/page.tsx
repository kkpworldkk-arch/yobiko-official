"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { OralExamBook, OralExamQuestionRecord, Student } from "@/lib/types";

interface BookDetailResponse {
  book: OralExamBook;
  questions: OralExamQuestionRecord[];
  assignedStudentIds: string[];
}

export default function OralExamBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [book, setBook] = useState<OralExamBook | null>(null);
  const [questions, setQuestions] = useState<OralExamQuestionRecord[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [roster, setRoster] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editingBook, setEditingBook] = useState(false);
  const [bookForm, setBookForm] = useState({ title: "", subject: "", description: "" });
  const [savingBook, setSavingBook] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [singleForm, setSingleForm] = useState({ category: "", prompt: "", modelAnswer: "" });
  const [isAddingSingle, setIsAddingSingle] = useState(false);

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionEditForm, setQuestionEditForm] = useState({
    category: "",
    prompt: "",
    modelAnswer: "",
  });

  const [isDeletingBook, setIsDeletingBook] = useState(false);

  function load() {
    Promise.all([
      fetch(`/api/oral-exam/books/${id}`).then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      }),
      fetch("/api/students").then((res) => res.json()),
    ])
      .then(([detail, studentsData]: [BookDetailResponse, { students: Student[] }]) => {
        setBook(detail.book);
        setQuestions(detail.questions);
        setAssignedIds(detail.assignedStudentIds);
        setBookForm({
          title: detail.book.title,
          subject: detail.book.subject,
          description: detail.book.description,
        });
        setRoster(studentsData.students ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingBook(true);
    try {
      const res = await fetch(`/api/oral-exam/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookForm),
      });
      if (!res.ok) throw new Error("failed");
      const data: { book: OralExamBook } = await res.json();
      setBook(data.book);
      setEditingBook(false);
    } finally {
      setSavingBook(false);
    }
  }

  async function handleDeleteBook() {
    if (!window.confirm("この参考書を削除しますか？問題と割り当ても削除されます（生徒の回答履歴は残ります）。")) {
      return;
    }
    setIsDeletingBook(true);
    try {
      await fetch(`/api/oral-exam/books/${id}`, { method: "DELETE" });
      window.location.href = "/dashboard/oral-exam";
    } finally {
      setIsDeletingBook(false);
    }
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bulkText.trim()) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/oral-exam/books/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulkText }),
      });
      const data = (await res.json()) as
        | { questions: OralExamQuestionRecord[] }
        | { error: string };
      if (!res.ok || !("questions" in data)) {
        throw new Error("error" in data ? data.error : "failed");
      }
      setQuestions((prev) => [...prev, ...data.questions]);
      setBulkText("");
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "取り込みに失敗しました。");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleAddSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!singleForm.prompt.trim()) return;
    setIsAddingSingle(true);
    try {
      const res = await fetch(`/api/oral-exam/books/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(singleForm),
      });
      if (!res.ok) throw new Error("failed");
      const data: { question: OralExamQuestionRecord } = await res.json();
      setQuestions((prev) => [...prev, data.question]);
      setSingleForm({ category: "", prompt: "", modelAnswer: "" });
    } finally {
      setIsAddingSingle(false);
    }
  }

  function startEditQuestion(q: OralExamQuestionRecord) {
    setEditingQuestionId(q.id);
    setQuestionEditForm({ category: q.category, prompt: q.prompt, modelAnswer: q.modelAnswer });
  }

  async function saveQuestionEdit(questionId: string) {
    const res = await fetch(`/api/oral-exam/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionEditForm),
    });
    if (!res.ok) return;
    const data: { question: OralExamQuestionRecord } = await res.json();
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? data.question : q)));
    setEditingQuestionId(null);
  }

  async function deleteQuestion(questionId: string) {
    if (!window.confirm("この問題を削除しますか？")) return;
    await fetch(`/api/oral-exam/questions/${questionId}`, { method: "DELETE" });
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }

  async function toggleAssignment(studentId: string, assigned: boolean) {
    if (assigned) {
      await fetch("/api/oral-exam/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, bookId: id }),
      });
      setAssignedIds((prev) => prev.filter((sid) => sid !== studentId));
    } else {
      await fetch("/api/oral-exam/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, bookId: id }),
      });
      setAssignedIds((prev) => [...prev, studentId]);
    }
  }

  if (isLoading) {
    return <p className="py-16 text-center text-body-sm text-slate-500">読み込み中…</p>;
  }

  if (notFound || !book) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-body-sm text-slate-400">参考書が見つかりませんでした。</p>
        <Link href="/dashboard/oral-exam" className="text-body-sm font-medium text-gold-400 hover:text-gold-300">
          一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/oral-exam"
        className="flex w-fit items-center gap-1.5 text-body-sm text-slate-400 transition-colors hover:text-ivory-200"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        一覧に戻る
      </Link>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        {!editingBook ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-h1 text-ivory-100">{book.title}</h1>
              {book.subject && <p className="mt-1 text-body-sm text-slate-400">{book.subject}</p>}
              {book.description && (
                <p className="mt-2 max-w-2xl text-body-sm text-slate-300">{book.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditingBook(true)} className="h-9 gap-1.5 px-3">
                <Pencil className="size-3.5" strokeWidth={1.75} />
                編集
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteBook}
                disabled={isDeletingBook}
                className="h-9 gap-1.5 px-3"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                削除
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveBook} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-title">参考書名</Label>
              <Input
                id="edit-title"
                value={bookForm.title}
                onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-subject">教科・分野</Label>
              <Input
                id="edit-subject"
                value={bookForm.subject}
                onChange={(e) => setBookForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-description">補足メモ</Label>
              <Textarea
                id="edit-description"
                rows={3}
                className="resize-none"
                value={bookForm.description}
                onChange={(e) => setBookForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingBook} className="bg-gold-500 text-navy-950 hover:bg-gold-400">
                {savingBook ? "保存しています…" : "保存する"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingBook(false)}>
                キャンセル
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">生徒への割り当て</h2>
        <p className="mt-1 mb-4 text-body-sm text-slate-400">
          割り当てた生徒のみ、この参考書で口頭試問に取り組めます。
        </p>
        <div className="flex flex-wrap gap-2">
          {roster.map((student) => {
            const assigned = assignedIds.includes(student.id);
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => toggleAssignment(student.id, assigned)}
                className={
                  assigned
                    ? "flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/[0.12] px-3 py-1.5 text-body-sm text-gold-400"
                    : "flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-body-sm text-slate-400 transition-colors duration-300 hover:border-gold-500/30 hover:text-ivory-200"
                }
              >
                {assigned && <Check className="size-3.5" strokeWidth={2} />}
                {student.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">問題をまとめて貼り付け</h2>
        <p className="mt-1 mb-4 text-body-sm text-slate-400">
          参考書のテキストをそのまま貼り付けられます。形式: 空行区切りのブロックごとに1問。
          <br />
          {"[カテゴリ名]（任意） / Q: 質問文 / A: 模範解答（任意）"} を1ブロックとして認識します。
          Q:/A: が無い場合は1行=1問として登録します。
        </p>
        <form onSubmit={handleBulkImport} className="flex flex-col gap-3">
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            className="resize-none font-mono text-caption"
            placeholder={"[第1章]\nQ: 水の化学式は何ですか。\nA: H2O\n\nQ: 次の質問…"}
          />
          {importError && <p className="text-caption text-crimson-500">{importError}</p>}
          <Button
            type="submit"
            disabled={isImporting || !bulkText.trim()}
            className="h-10 w-fit gap-1.5 bg-gold-500 px-4 text-navy-950 hover:bg-gold-400"
          >
            {isImporting ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPaste className="size-4" />}
            まとめて登録する
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">問題を1問ずつ追加</h2>
        <form onSubmit={handleAddSingle} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              placeholder="カテゴリ（任意）"
              value={singleForm.category}
              onChange={(e) => setSingleForm((f) => ({ ...f, category: e.target.value }))}
              className="sm:col-span-1"
            />
            <Input
              placeholder="質問文"
              value={singleForm.prompt}
              onChange={(e) => setSingleForm((f) => ({ ...f, prompt: e.target.value }))}
              className="sm:col-span-2"
              required
            />
          </div>
          <Textarea
            placeholder="模範解答（任意。空欄でも登録できます）"
            rows={2}
            className="resize-none"
            value={singleForm.modelAnswer}
            onChange={(e) => setSingleForm((f) => ({ ...f, modelAnswer: e.target.value }))}
          />
          <Button
            type="submit"
            disabled={isAddingSingle || !singleForm.prompt.trim()}
            variant="secondary"
            className="h-9 w-fit gap-1.5 px-3"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            追加する
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-panel">
        <h2 className="text-h3 text-ivory-100">問題一覧（{questions.length}問）</h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {questions.length === 0 && (
            <p className="py-6 text-center text-body-sm text-slate-500">まだ問題がありません。</p>
          )}
          {questions.map((q) => (
            <div key={q.id} className="py-4 first:pt-0 last:pb-0">
              {editingQuestionId === q.id ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      value={questionEditForm.category}
                      onChange={(e) =>
                        setQuestionEditForm((f) => ({ ...f, category: e.target.value }))
                      }
                      placeholder="カテゴリ"
                      className="sm:col-span-1"
                    />
                    <Input
                      value={questionEditForm.prompt}
                      onChange={(e) => setQuestionEditForm((f) => ({ ...f, prompt: e.target.value }))}
                      placeholder="質問文"
                      className="sm:col-span-2"
                    />
                  </div>
                  <Textarea
                    value={questionEditForm.modelAnswer}
                    onChange={(e) =>
                      setQuestionEditForm((f) => ({ ...f, modelAnswer: e.target.value }))
                    }
                    rows={2}
                    className="resize-none"
                    placeholder="模範解答"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => saveQuestionEdit(q.id)}
                      className="h-8 bg-gold-500 px-3 text-caption text-navy-950 hover:bg-gold-400"
                    >
                      保存
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingQuestionId(null)}
                      className="h-8 px-3 text-caption"
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {q.category && (
                      <span className="text-caption font-medium uppercase tracking-[0.1em] text-gold-400/80">
                        {q.category}
                      </span>
                    )}
                    <p className="mt-1 text-body-sm text-ivory-100">{q.prompt}</p>
                    {q.modelAnswer && (
                      <p className="mt-1 text-caption text-slate-500">模範解答: {q.modelAnswer}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => startEditQuestion(q)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => deleteQuestion(q.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <Separator />
    </div>
  );
}
