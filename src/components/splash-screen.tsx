"use client";

import { useEffect, useRef } from "react";

// アプリ起動時(初回ロード時)だけロゴを表示して消す演出。
// ルートレイアウトに一度だけマウントされるため、ページ内のリンク遷移では再表示されず、
// ブラウザでの新規読み込み・リロード時にだけ発生する。
//
// 表示時間は「起動から最低2秒、読み込みがそれより長くかかるときは読み込みが終わるまで」。
// 読み込み完了はJavaScriptで検知してフェードアウトを始める。万一JavaScriptが動かない環境
// （通信が極端に遅い端末など）でも、画面がこの紺色のまま止まらないよう、CSSアニメーションだけでも
// MAX_MS 後には必ず消える。
const MIN_MS = 2000;
const MAX_MS = 15000;
const FADE_MS = 250;

export function SplashScreen() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const leave = () => {
      // performance.now() はページを開いた瞬間からの経過時間。最低表示時間に足りない分だけ待つ。
      const wait = Math.max(0, MIN_MS - performance.now());
      timer = setTimeout(() => {
        el.style.animation = `splash-leave ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`;
      }, wait);
    };
    if (document.readyState === "complete") {
      leave();
    } else {
      window.addEventListener("load", leave, { once: true });
    }
    return () => {
      window.removeEventListener("load", leave);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999] flex items-center justify-center bg-navy-950"
      style={{
        animation: `splash-leave ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${MAX_MS}ms forwards`,
      }}
    >
      <style>{`
        @keyframes splash-leave { to { opacity: 0; visibility: hidden; } }
        @keyframes splash-logo-enter { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes splash-logo-enter { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
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
        className="relative w-36 rounded-[22%] shadow-panel-lg sm:w-44"
        style={{ animation: "splash-logo-enter 700ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      />
    </div>
  );
}
