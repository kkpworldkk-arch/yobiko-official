"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePassword,
  type ChangePasswordState,
} from "@/app/actions/student-settings";

const initialState: ChangePasswordState = {};

export function StudentPasswordForm() {
  const [state, formAction, isSubmitting] = useActionState(
    changePassword,
    initialState,
  );

  return (
    <form
      action={formAction}
      key={state.success ? "reset" : "form"}
      className="flex flex-col gap-4"
    >
      {state.error && (
        <p className="rounded-lg border border-crimson-500/25 bg-crimson-500/[0.06] px-3.5 py-2.5 text-body-sm text-crimson-400">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-sage-500/25 bg-sage-500/[0.06] px-3.5 py-2.5 text-body-sm text-sage-500">
          パスワードを変更しました。
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="currentPassword" className="text-body-sm text-ivory-200">
          現在のパスワード
        </Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="newPassword" className="text-body-sm text-ivory-200">
          新しいパスワード(8文字以上)
        </Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword" className="text-body-sm text-ivory-200">
          新しいパスワード(確認)
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 h-11 w-fit bg-gold-500 px-5 text-body-sm font-medium text-navy-950 shadow-gold-glow transition-all duration-400 ease-luxury hover:bg-gold-400 disabled:opacity-70"
      >
        <KeyRound className="mr-1.5 size-4" strokeWidth={1.75} />
        {isSubmitting ? "変更しています…" : "パスワードを変更"}
      </Button>
    </form>
  );
}
