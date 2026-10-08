"use server";

import { redirect } from "next/navigation";
import { getUserByEmail, type UserRole } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

export interface LoginState {
  error?: string;
}

const ROLE_HOME: Record<UserRole, string> = {
  teacher: "/dashboard",
  family: "/student",
};

const ROLE_LABEL: Record<UserRole, string> = {
  teacher: "講師としてログイン",
  family: "生徒・保護者",
};

// メールアドレス単位でのブルートフォース対策。単一プロセスで動くこのアプリの範囲では
// プロセス内メモリで十分（複数インスタンス構成にする場合は共有ストアに置き換えること）。
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface FailedLoginState {
  count: number;
  firstFailureAt: number;
  lockedUntil?: number;
}
const failedLogins = new Map<string, FailedLoginState>();

function getActiveLock(email: string): FailedLoginState | undefined {
  const state = failedLogins.get(email);
  if (!state) return undefined;
  const expired =
    (!state.lockedUntil || Date.now() > state.lockedUntil) &&
    Date.now() - state.firstFailureAt > FAILED_LOGIN_WINDOW_MS;
  if (expired) {
    failedLogins.delete(email);
    return undefined;
  }
  return state;
}

function registerFailedLogin(email: string): void {
  const now = Date.now();
  const state = failedLogins.get(email);
  if (!state || now - state.firstFailureAt > FAILED_LOGIN_WINDOW_MS) {
    failedLogins.set(email, { count: 1, firstFailureAt: now });
    return;
  }
  state.count += 1;
  if (state.count >= MAX_FAILED_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_MS;
  }
}

function clearFailedLogin(email: string): void {
  failedLogins.delete(email);
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedRole = String(formData.get("role") ?? "") as UserRole;

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const activeLock = getActiveLock(email);
  if (activeLock?.lockedUntil && Date.now() < activeLock.lockedUntil) {
    const minutes = Math.ceil((activeLock.lockedUntil - Date.now()) / 60_000);
    return {
      error: `ログイン試行の回数が多すぎます。${minutes}分後に再度お試しください。`,
    };
  }

  const user = getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    registerFailedLogin(email);
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }
  clearFailedLogin(email);

  if (requestedRole && user.role !== requestedRole) {
    return {
      error: `このアカウントは「${ROLE_LABEL[user.role]}」用です。タブを切り替えてください。`,
    };
  }

  await createSession({ userId: user.id, role: user.role, name: user.name });
  redirect(ROLE_HOME[user.role]);
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
