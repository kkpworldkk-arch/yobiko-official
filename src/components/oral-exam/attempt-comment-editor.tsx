"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AttemptCommentEditor({
  attemptId,
  initialComment,
}: {
  attemptId: string;
  initialComment: string;
}) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(initialComment);
  const [saved, setSaved] = useState(initialComment);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    try {
      await fetch("/api/oral-exam/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attemptId, comment }),
      });
      setSaved(comment);
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  if (!editing) {
    return saved ? (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 flex items-start gap-1.5 text-left text-caption text-gold-400 hover:text-gold-300"
      >
        講師コメント: {saved}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 flex items-center gap-1 text-caption text-slate-500 hover:text-ivory-200"
      >
        <MessageSquarePlus className="size-3.5" strokeWidth={1.75} />
        コメントを追加
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="resize-none text-caption"
        placeholder="この回答について生徒に伝えたいことをメモできます"
      />
      <div className="flex gap-1.5">
        <Button type="button" onClick={save} disabled={isSaving} className="h-7 px-2.5 text-caption">
          {isSaving ? "保存中…" : "保存"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setComment(saved);
            setEditing(false);
          }}
          className="h-7 px-2.5 text-caption"
        >
          キャンセル
        </Button>
      </div>
    </div>
  );
}
