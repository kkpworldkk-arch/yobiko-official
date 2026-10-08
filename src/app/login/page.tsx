"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasskeyButton } from "@/components/passkey-button";
import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export default function LoginPage() {
  const [role, setRole] = useState<"teacher" | "family">("teacher");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isSubmitting] = useActionState(
    login,
    initialState,
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-6 py-12">
      {/* Ambient luxury vignette — 主張しない光の演出 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(196,160,92,0.10) 0%, rgba(196,160,92,0) 60%), radial-gradient(80% 60% at 50% 100%, rgba(38,50,87,0.35) 0%, rgba(5,7,13,0) 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="mb-9 flex flex-col items-center gap-4 text-center">
          <div className="flex size-11 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/[0.08]">
            <ShieldCheck className="size-5 text-gold-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-eyebrow uppercase tracking-[0.24em] text-gold-400/90">
              滝原塾専用アプリ
            </p>
            <h1 className="mt-2.5 text-h1 text-ivory-100">
              おかえりなさいませ
            </h1>
            <p className="mt-2 text-body-sm text-slate-400">
              医学部合格までの歩みを、専属アプリで支えます。
            </p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-white/[0.06] bg-card p-7 shadow-panel-lg">
          <Tabs
            value={role}
            onValueChange={(value) => setRole(value as typeof role)}
          >
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="teacher">講師としてログイン</TabsTrigger>
              <TabsTrigger value="family">生徒・保護者</TabsTrigger>
            </TabsList>
          </Tabs>

          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="role" value={role} />

            {state.error && (
              <p className="rounded-lg border border-crimson-500/25 bg-crimson-500/[0.06] px-3.5 py-2.5 text-body-sm text-crimson-400">
                {state.error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-body-sm text-ivory-200">
                メールアドレス
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@takihara-juku.jp"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-body-sm text-ivory-200"
                >
                  パスワード
                </Label>
                <a
                  href="#"
                  className="text-caption text-slate-400 transition-colors duration-300 hover:text-gold-400"
                >
                  お忘れですか
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  className="h-11 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-300 hover:text-ivory-200"
                  aria-label={
                    showPassword ? "パスワードを隠す" : "パスワードを表示"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-11 w-full bg-gold-500 text-body font-medium text-navy-950 shadow-gold-glow transition-all duration-400 ease-luxury hover:bg-gold-400 disabled:opacity-70"
            >
              {isSubmitting ? "確認しています…" : "ログイン"}
            </Button>
            <PasskeyButton mode="login" email={email} />
          </form>
        </div>

        <p className="mt-8 text-center text-caption leading-relaxed text-slate-500">
          本プラットフォームは会員制医学部受験サービスの一部として提供されます。
          <br />
          お困りの際は専属コンシェルジュまでご連絡ください。
        </p>
      </div>
    </main>
  );
}
