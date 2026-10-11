"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount, type DeleteAccountState } from "@/app/actions/student-settings";

const initialState: DeleteAccountState = {};

export function DeleteAccountForm() {
  const [state, formAction, isSubmitting] = useActionState(deleteAccount, initialState);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="h-10 w-fit gap-1.5 px-4 text-body-sm text-crimson-500"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
        アカウントを削除する
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-crimson-500/25 bg-crimson-500/[0.04] p-4">
      <p className="text-body-sm leading-relaxed text-slate-300">
        削除すると、ログイン情報と、これまでの口頭試問の回答・習熟度・AIチューターの履歴がすべて消え、元に戻せません。
        再び利用するには、講師にアカウントを発行し直してもらう必要があります。
      </p>

      {state.error && (
        <p className="rounded-lg border border-crimson-500/25 bg-crimson-500/[0.06] px-3.5 py-2.5 text-body-sm text-crimson-500">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-password" className="text-body-sm text-ivory-200">
          確認のため、パスワードを入力してください
        </Label>
        <Input
          id="delete-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11"
        />
      </div>

      <label className="flex items-center gap-2 text-body-sm text-slate-300">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="size-4 accent-crimson-500"
        />
        削除すると元に戻せないことを理解しました
      </label>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!confirmed || isSubmitting}
          className="h-10 bg-crimson-500 px-4 text-body-sm font-medium text-ivory-100 hover:bg-crimson-500/90 disabled:opacity-60"
        >
          {isSubmitting ? "削除しています…" : "完全に削除する"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setConfirmed(false);
          }}
          className="h-10 px-4 text-body-sm"
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}
