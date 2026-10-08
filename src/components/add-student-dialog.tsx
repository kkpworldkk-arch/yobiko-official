"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Student } from "@/lib/types";

export function AddStudentDialog({
  onAdded,
}: {
  onAdded: (student: Student) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      grade: String(formData.get("grade") ?? "").trim(),
      targetUniversity: String(formData.get("targetUniversity") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");

      const data: { student: Student } = await res.json();
      onAdded(data.student);
      setOpen(false);
      event.currentTarget.reset();
    } catch {
      setError("生徒の追加に失敗しました。入力内容を確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gold-500/30 bg-gold-500/[0.08] px-3 text-body-sm font-medium text-gold-400 transition-colors duration-300 hover:bg-gold-500/[0.14]">
        <Plus className="size-4" strokeWidth={2} />
        生徒を追加
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しい生徒を追加</DialogTitle>
          <DialogDescription>
            基本情報のみ登録します。学習実績はこの生徒が質問を送るたびに蓄積されます。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">氏名</Label>
            <Input id="name" name="name" required placeholder="例: 山田 太郎" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="grade">学年</Label>
            <Input id="grade" name="grade" required placeholder="例: 高3、既卒1年" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="targetUniversity">志望大学</Label>
            <Input
              id="targetUniversity"
              name="targetUniversity"
              required
              placeholder="例: 久留米大学"
            />
          </div>
          {error && <p className="text-caption text-crimson-500">{error}</p>}

          <DialogFooter className="mt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gold-500 text-navy-950 hover:bg-gold-400"
            >
              {isSubmitting ? "追加しています…" : "追加する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
