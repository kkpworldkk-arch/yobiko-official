"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitStudentFeedback,
  type SubmitFeedbackState,
} from "@/app/actions/student-settings";

const initialState: SubmitFeedbackState = {};

export function StudentFeedbackForm() {
  const [state, formAction, isSubmitting] = useActionState(
    submitStudentFeedback,
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
          送信しました。講師に届きます。
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="message" className="text-body-sm text-ivory-200">
          ここを直してほしい、気になる点など
        </Label>
        <Textarea
          id="message"
          name="message"
          required
          maxLength={2000}
          rows={4}
          placeholder="例: 口頭試問の◯◯の問題が意味不明でした"
          className="resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-fit bg-gold-500 px-5 text-body-sm font-medium text-navy-950 shadow-gold-glow transition-all duration-400 ease-luxury hover:bg-gold-400 disabled:opacity-70"
      >
        <Send className="mr-1.5 size-4" strokeWidth={1.75} />
        {isSubmitting ? "送信しています…" : "送信"}
      </Button>
    </form>
  );
}
