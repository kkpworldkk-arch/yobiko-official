"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// リンクを押してから 8 秒たっても画面が切り替わらないときは、ブラウザ標準の読み込みで開き直す。
// iPad のアプリ（WebView）は、バックグラウンドから戻った直後や通信が不安定なときに、
// Next.js の画面切り替え用の通信が止まったまま、何も起きなくなることがある。
const STALL_MS = 8000;

function Guard() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  const [pending, setPending] = useState<{ from: string; href: string } | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = `${url.pathname}?${url.searchParams.toString()}`;
      // 同じページ内の移動（#feedback など）や、今いるページへのリンクは待つ必要がない
      if (next === `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`) return;
      setPending({ from: here, href: url.href });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [here]);

  // 画面が切り替わると here が変わり、pending は古い扱いになって表示もタイマーも止まる
  const active = pending && pending.from === here ? pending : null;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => window.location.assign(active.href), STALL_MS);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-gold-400" />
      <style>{`@keyframes nav-progress { from { transform: translateX(-100%); } to { transform: translateX(300%); } }`}</style>
    </div>
  );
}

export function NavigationGuard() {
  return (
    <Suspense fallback={null}>
      <Guard />
    </Suspense>
  );
}
