// アプリ起動時(初回ロード時)だけ一瞬ロゴを表示して消す演出。
// ルートレイアウトに一度だけマウントされるため、ページ内のリンク遷移では再表示されず、
// ブラウザでの新規読み込み・リロード時にだけ発生する。
//
// 表示・フェードアウトはCSSアニメーションだけで行う。JavaScriptの読み込みや実行が遅い環境
// （通信の遅い端末、iOSアプリのWebView）でも、画面がこの紺色のまま止まらないようにするため。
const HOLD_MS = 350;
const FADE_MS = 250;

export function SplashScreen() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999] flex items-center justify-center bg-navy-950"
      style={{
        animation: `splash-leave ${FADE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${HOLD_MS}ms forwards`,
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
