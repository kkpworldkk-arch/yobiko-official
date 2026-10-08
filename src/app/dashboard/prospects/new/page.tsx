"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECTS, UNIVERSITIES } from "@/lib/mock-data";
import type { ExamSubjectScore, ExamUnitScore } from "@/lib/types";

interface SubjectRow {
  subject: string;
  score: string;
  fullScore: string;
  deviation: string;
}

interface UnitRow {
  id: string;
  subject: string;
  unit: string;
  correctRate: string;
}

function createEmptyUnitRow(): UnitRow {
  return {
    id: crypto.randomUUID(),
    subject: SUBJECTS[0],
    unit: "",
    correctRate: "",
  };
}

export default function NewProspectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [targetUniversity, setTargetUniversity] = useState("");
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [notes, setNotes] = useState("");

  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>(
    SUBJECTS.map((subject) => ({
      subject,
      score: "",
      fullScore: "100",
      deviation: "",
    })),
  );
  const [unitRows, setUnitRows] = useState<UnitRow[]>([
    createEmptyUnitRow(),
    createEmptyUnitRow(),
    createEmptyUnitRow(),
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateSubjectRow(index: number, patch: Partial<SubjectRow>) {
    setSubjectRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function updateUnitRow(id: string, patch: Partial<UnitRow>) {
    setUnitRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeUnitRow(id: string) {
    setUnitRows((prev) => prev.filter((row) => row.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const subjects: ExamSubjectScore[] = subjectRows
      .filter((row) => row.score.trim() !== "" && Number.isFinite(Number(row.score)))
      .map((row) => {
        const parsedFullScore = Number(row.fullScore);
        const parsedDeviation = Number(row.deviation);
        return {
          subject: row.subject,
          score: Number(row.score),
          fullScore: Number.isFinite(parsedFullScore) && parsedFullScore > 0 ? parsedFullScore : 100,
          deviation:
            row.deviation.trim() === "" || !Number.isFinite(parsedDeviation)
              ? null
              : parsedDeviation,
        };
      });

    const units: ExamUnitScore[] = unitRows
      .filter(
        (row) =>
          row.unit.trim() !== "" &&
          row.correctRate.trim() !== "" &&
          Number.isFinite(Number(row.correctRate)),
      )
      .map((row) => ({
        subject: row.subject,
        unit: row.unit.trim(),
        correctRate: Math.max(0, Math.min(100, Number(row.correctRate))),
      }));

    if (!name.trim() || !grade.trim() || !targetUniversity.trim() || !examName.trim()) {
      setErrorMessage("氏名・学年・志望大学・模試名は必須です。");
      return;
    }
    if (subjects.length === 0 && units.length === 0) {
      setErrorMessage("教科別得点、または分野別正答率のいずれかを入力してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          grade: grade.trim(),
          targetUniversity: targetUniversity.trim(),
          examName: examName.trim(),
          examDate: examDate.trim(),
          subjects,
          units,
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "診断の作成に失敗しました。");
      }

      const data: { assessment: { id: string } } = await res.json();
      router.push(`/dashboard/prospects/${data.assessment.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "診断の作成に失敗しました。",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 text-ivory-100">新しい弱点診断を作成</h1>
        <p className="mt-1 text-body-sm text-slate-400">
          入塾を検討中の生徒の模試結果を入力すると、弱点診断レポートを作成します。
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-panel"
      >
        <div>
          <p className="mb-2.5 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
            生徒情報
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">氏名</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 山田 太郎"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grade">学年</Label>
              <Input
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="例: 高3、既卒1年"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetUniversity">志望大学</Label>
              <Input
                id="targetUniversity"
                value={targetUniversity}
                onChange={(e) => setTargetUniversity(e.target.value)}
                list="universitySuggestions"
                placeholder="例: 久留米大学"
              />
              <datalist id="universitySuggestions">
                {UNIVERSITIES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-2.5 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
            模試情報
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="examName">模試名</Label>
              <Input
                id="examName"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="例: 第2回medical模試"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="examDate">受験日（任意）</Label>
              <Input
                id="examDate"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                placeholder="例: 2026年6月"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-1 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
            教科別得点
          </p>
          <p className="mb-3 text-caption text-slate-500">
            分かる教科だけで構いません。空欄の教科は診断から除外されます。
          </p>
          <div className="flex flex-col gap-2.5">
            {subjectRows.map((row, index) => (
              <div
                key={row.subject}
                className="grid grid-cols-[minmax(0,4rem)_1fr_auto_1fr_1fr] items-center gap-2.5"
              >
                <span className="text-body-sm text-ivory-200">{row.subject}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.score}
                  onChange={(e) => updateSubjectRow(index, { score: e.target.value })}
                  placeholder="得点"
                  className="h-10"
                />
                <span className="text-body-sm text-slate-500">/</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.fullScore}
                  onChange={(e) =>
                    updateSubjectRow(index, { fullScore: e.target.value })
                  }
                  placeholder="満点"
                  className="h-10"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.deviation}
                  onChange={(e) =>
                    updateSubjectRow(index, { deviation: e.target.value })
                  }
                  placeholder="偏差値（任意）"
                  className="h-10"
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-1 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
            分野別正答率（任意）
          </p>
          <p className="mb-3 text-caption text-slate-500">
            大問別・分野別の結果があると、より具体的な弱点分析ができます。
          </p>
          <div className="flex flex-col gap-2.5">
            {unitRows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,7rem)_1fr_minmax(0,7rem)_auto] items-center gap-2.5"
              >
                <Select
                  value={row.subject}
                  onValueChange={(v) => updateUnitRow(row.id, { subject: v as string })}
                >
                  <SelectTrigger className="h-10 w-full">
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
                  value={row.unit}
                  onChange={(e) => updateUnitRow(row.id, { unit: e.target.value })}
                  placeholder="分野名（例: 確率、構文）"
                  className="h-10"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={row.correctRate}
                  onChange={(e) =>
                    updateUnitRow(row.id, { correctRate: e.target.value })
                  }
                  placeholder="正答率%"
                  className="h-10"
                />
                <button
                  type="button"
                  onClick={() => removeUnitRow(row.id)}
                  aria-label="この分野を削除"
                  className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-crimson-500"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setUnitRows((prev) => [...prev, createEmptyUnitRow()])}
            className="mt-3 h-9 gap-1.5 px-3"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            分野を追加
          </Button>
        </div>

        <Separator />

        <div>
          <p className="mb-2.5 text-eyebrow uppercase tracking-[0.16em] text-slate-500">
            講師からの所見（任意）
          </p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="面談で気になった点、保護者からの要望など"
            rows={3}
            className="resize-none"
          />
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-crimson-500/25 bg-crimson-500/[0.06] px-3.5 py-3 text-body-sm text-slate-200">
            <TriangleAlert className="size-4 shrink-0 text-crimson-500" strokeWidth={1.75} />
            {errorMessage}
          </div>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full gap-1.5 bg-gold-500 text-body font-medium text-navy-950 shadow-gold-glow transition-all duration-400 ease-luxury hover:bg-gold-400 disabled:opacity-60 sm:w-auto sm:self-end sm:px-6"
        >
          <Send className="size-4" />
          {isSubmitting ? "診断レポートを作成しています…" : "診断レポートを作成"}
        </Button>
      </form>
    </div>
  );
}
