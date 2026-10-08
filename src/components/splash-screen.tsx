"use client";

import { useEffect, useState } from "react";

// アプリ起動時(初回ロード時)だけ一瞬ロゴを表示して消す演出。
// ルートレイアウトに一度だけマウントされるため、ページ内のリンク遷移では再表示されず、
// ブラウザでの新規読み込み・リロード時にだけ発生する。
const HOLD_MS = 350;
const FADE_MS = 250;

export function SplashScreen() {
  const [mounted, setMounted] = useState(true);
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setEntered(true));
    const leaveTimer = setTimeout(() => setLeaving(true), HOLD_MS);
    const unmountTimer = setTimeout(() => setMounted(false), HOLD_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(enterFrame);
      clearTimeout(leaveTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-navy-950 transition-opacity ease-luxury ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, rgba(196,160,92,0.10) 0%, rgba(196,160,92,0) 60%), radial-gradient(80% 60% at 50% 100%, rgba(38,50,87,0.4) 0%, rgba(5,7,13,0) 60%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-vertical.png"
        alt="滝原塾"
        width={176}
        height={176}
        className={`relative w-36 rounded-[22%] shadow-panel-lg transition-all ease-luxury motion-reduce:transition-opacity sm:w-44 ${
          entered ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        style={{ transitionDuration: "700ms" }}
      />
    </div>
  );
}
