"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";

export function CreateBookDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      title: String(formData.get("title") ?? "").trim(),
      subject: String(formData.get("subject") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/oral-exam/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("failed");

      const data: { book: { id: string } } = await res.json();
      setOpen(false);
      event.currentTarget.reset();
      router.push(`/dashboard/oral-exam/books/${data.book.id}`);
      router.refresh();
    } catch {
      setError("参考書の作成に失敗しました。入力内容を確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gold-500/30 bg-gold-500/[0.08] px-3 text-body-sm font-medium text-gold-400 transition-colors duration-300 hover:bg-gold-500/[0.14]">
        <Plus className="size-4" strokeWidth={2} />
        参考書を追加
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新しい参考書を追加</DialogTitle>
          <DialogDescription>
            まずタイトルだけ登録し、問題は詳細画面でまとめて貼り付け登録できます。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">参考書名</Label>
            <Input id="title" name="title" required placeholder="例: 英単語ターゲット1900" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">教科・分野</Label>
            <Input id="subject" name="subject" placeholder="例: 英語・単語、化学・有機化学 など" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">補足メモ</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              className="resize-none"
              placeholder="任意（この参考書の使い方や狙いなど）"
            />
          </div>
          {error && <p className="text-caption text-crimson-500">{error}</p>}

          <DialogFooter className="mt-1">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gold-500 text-navy-950 hover:bg-gold-400"
            >
              {isSubmitting ? "作成しています…" : "作成する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
