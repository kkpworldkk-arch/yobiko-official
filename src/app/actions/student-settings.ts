"use server";

import { revalidatePath } from "next/cache";
import {
  getUserById,
  insertStudentFeedback,
  updateUserPassword,
} from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/session";
import { resolveStudentIdentity } from "@/lib/student-identity";

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getSession();
  if (!session) {
    return { error: "ログインが必要です。" };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "すべての項目を入力してください。" };
  }
  if (newPassword.length < 8) {
    return { error: "新しいパスワードは8文字以上にしてください。" };
  }
  if (newPassword !== confirmPassword) {
    return { error: "新しいパスワードが一致しません。" };
  }

  const user = getUserById(session.userId);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return { error: "現在のパスワードが正しくありません。" };
  }

  updateUserPassword(user.id, hashPassword(newPassword));
  return { success: true };
}

export interface SubmitFeedbackState {
  error?: string;
  success?: boolean;
}

export async function submitStudentFeedback(
  _prevState: SubmitFeedbackState,
  formData: FormData,
): Promise<SubmitFeedbackState> {
  const session = await getSession();
  if (!session) {
    return { error: "ログインが必要です。" };
  }

  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    return { error: "内容を入力してください。" };
  }
  if (message.length > 2000) {
    return { error: "2000文字以内で入力してください。" };
  }

  const identity = resolveStudentIdentity(session);
  insertStudentFeedback({
    userId: session.userId,
    studentName: identity.isDemo ? session.name : identity.name,
    message,
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
