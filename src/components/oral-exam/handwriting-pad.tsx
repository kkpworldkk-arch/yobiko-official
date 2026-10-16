"use client";

// 口頭試問の手書き回答欄。
// - 線をベクターデータ（点の列）として持ち、画面サイズが変わっても描き直せるようにしている。
//   これにより「1画ずつ消す消しゴム」「元に戻す」「全画面で広く書く」を実現している。
// - AI に送る画像は、書いた範囲だけを切り出して白地・濃い線で描き直したものにする
//   （余白だらけの小さな画像より、字が大きくはっきり写るため読み取りの精度が上がる）。
// - Apple Pencil で書いているときは指・手のひらのタッチを無視する（パームリジェクション）。

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Eraser, Maximize2, Minimize2, PenLine, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Stroke = Point[];
type Tool = "pen" | "eraser";

export interface HandwritingPadHandle {
  /** 書いた範囲を切り出した PNG の data URL。何も書いていなければ undefined */
  exportImage: () => string | undefined;
  clear: () => void;
}

const PEN_WIDTH = 3;
const ERASER_RADIUS = 14;
const INK = "#10141f";
const EXPORT_MAX_SIDE = 1568;
const EXPORT_PADDING = 24;

export function HandwritingPad({
  ref,
  prompt,
  onFirstInput,
  onInkChange,
}: {
  ref?: Ref<HandwritingPadHandle>;
  /** 全画面表示のときに上に出す問題文 */
  prompt?: string;
  onFirstInput?: () => void;
  onInkChange?: (hasInk: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const historyRef = useRef<Stroke[][]>([]);
  const activePointerRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);
  const penSeenRef = useRef(false);
  const viewScaleRef = useRef(1);

  const [tool, setTool] = useState<Tool>("pen");
  const [expanded, setExpanded] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);

  const syncState = useCallback(() => {
    const count = strokesRef.current.length;
    setStrokeCount(count);
    setCanUndo(historyRef.current.length > 0);
    onInkChange?.(count > 0);
  }, [onInkChange]);

  // 全画面から戻ったときなど、書いた内容が枠に収まらない場合は縮小して全体を見せる。
  const computeViewScale = useCallback((width: number, height: number) => {
    let maxX = 0;
    let maxY = 0;
    for (const stroke of strokesRef.current) {
      for (const p of stroke) {
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const margin = 16;
    return Math.min(1, width / (maxX + margin), height / (maxY + margin));
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const scale = viewScaleRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke, PEN_WIDTH);
  }, []);

  // キャンバスの表示サイズに合わせて解像度を合わせ、描き直す。
  // 非表示のタブから表示に切り替わったとき・全画面の切り替え時にも呼ばれる。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      if (activePointerRef.current === null) {
        viewScaleRef.current = computeViewScale(rect.width, rect.height);
      }
      redraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, [computeViewScale, redraw]);

  // 全画面中は後ろのページがスクロールしないようにする。
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  const pushHistory = () => {
    historyRef.current.push(strokesRef.current.slice());
    if (historyRef.current.length > 100) historyRef.current.shift();
  };

  const clear = useCallback(() => {
    if (strokesRef.current.length > 0) {
      historyRef.current.push(strokesRef.current.slice());
    }
    strokesRef.current = [];
    viewScaleRef.current = 1;
    redraw();
    syncState();
  }, [redraw, syncState]);

  const undo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    strokesRef.current = previous;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      viewScaleRef.current = computeViewScale(rect.width, rect.height);
    }
    redraw();
    syncState();
  };

  useImperativeHandle(
    ref,
    () => ({
      exportImage: () => exportStrokes(strokesRef.current),
      clear,
    }),
    [clear],
  );

  function toWorld(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scale = viewScaleRef.current;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function eraseAt(point: Point) {
    const radius = ERASER_RADIUS / viewScaleRef.current;
    const remaining = strokesRef.current.filter((stroke) => !strokeHits(stroke, point, radius));
    if (remaining.length !== strokesRef.current.length) {
      strokesRef.current = remaining;
      redraw();
      syncState();
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "pen") penSeenRef.current = true;
    // ペンを使っている間は、画面に触れた手のひら・指を線として扱わない。
    if (e.pointerType === "touch" && penSeenRef.current) return;
    if (activePointerRef.current !== null) return;
    e.preventDefault();
    onFirstInput?.();
    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    const point = toWorld(e);
    // ペンの消しゴム側（対応ペンのみ）でこすった場合も消しゴムとして扱う。
    if (tool === "eraser" || (e.buttons & 32) !== 0) {
      erasingRef.current = true;
      pushHistory();
      eraseAt(point);
      return;
    }
    pushHistory();
    const stroke: Stroke = [point];
    activeStrokeRef.current = stroke;
    strokesRef.current = [...strokesRef.current, stroke];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawStroke(ctx, stroke, PEN_WIDTH);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return;
    // iPad では1回のイベントに複数の点がまとまって届くので、すべて拾って線を滑らかにする。
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = events.length > 0 ? events : [e.nativeEvent];

    if (erasingRef.current) {
      for (const sample of samples) eraseAt(toWorld(sample));
      return;
    }

    const stroke = activeStrokeRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!stroke || !ctx) return;
    for (const sample of samples) {
      const point = toWorld(sample);
      const last = stroke[stroke.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) < 0.6) continue;
      stroke.push(point);
      drawLatestSegment(ctx, stroke, PEN_WIDTH);
    }
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (erasingRef.current) {
      erasingRef.current = false;
      // 何も消えなかったときは、元に戻す履歴を残さない。
      const last = historyRef.current[historyRef.current.length - 1];
      if (last && last.length === strokesRef.current.length) historyRef.current.pop();
      syncState();
      return;
    }
    activeStrokeRef.current = null;
    redraw();
    syncState();
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        expanded &&
          "fixed inset-0 z-50 bg-navy-950 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)]",
      )}
    >
      {expanded && prompt && (
        <p className="line-clamp-3 px-1 text-body-sm leading-relaxed text-ivory-100">{prompt}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-navy-800/80 p-[3px]" role="radiogroup" aria-label="道具">
          <ToolButton active={tool === "pen"} onClick={() => setTool("pen")} label="ペン">
            <PenLine className="size-4" strokeWidth={1.75} />
          </ToolButton>
          <ToolButton active={tool === "eraser"} onClick={() => setTool("eraser")} label="消しゴム">
            <Eraser className="size-4" strokeWidth={1.75} />
          </ToolButton>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={undo}
          disabled={!canUndo}
          className="h-9 gap-1.5 px-3"
        >
          <Undo2 className="size-4" strokeWidth={1.75} />
          元に戻す
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={clear}
          disabled={strokeCount === 0}
          className="h-9 gap-1.5 px-3"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
          全部消す
        </Button>
        <Button
          type="button"
          variant={expanded ? "default" : "secondary"}
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto h-9 gap-1.5 px-3"
        >
          {expanded ? (
            <>
              <Minimize2 className="size-4" strokeWidth={1.75} />
              閉じる
            </>
          ) : (
            <>
              <Maximize2 className="size-4" strokeWidth={1.75} />
              全画面で書く
            </>
          )}
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "w-full touch-none select-none rounded-lg border border-white/10 [-webkit-touch-callout:none]",
          expanded ? "min-h-0 flex-1" : "h-[min(60vh,480px)] min-h-72",
          tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
        )}
      />

      {!expanded && (
        <p className="text-caption text-slate-500">
          消しゴムは、なぞった線を1画ずつ消します。式の展開など長い回答は「全画面で書く」が便利です。
        </p>
      )}
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-body-sm transition-colors",
        active ? "bg-gold-500/20 text-gold-300" : "text-slate-400 hover:text-ivory-100",
      )}
    >
      {children}
      {label}
    </button>
  );
}

// 点の中間点を通る2次ベジェ曲線でつなぎ、カクつきの少ない線にする。
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  for (let i = 1; i < stroke.length - 1; i++) {
    const mid = midpoint(stroke[i], stroke[i + 1]);
    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, mid.x, mid.y);
  }
  const last = stroke[stroke.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

// 書いている最中は、最後に追加された区間だけを描き足す（毎回全体を描き直すと重くなるため）。
// 書き終わったら redraw() で全体を滑らかな線に描き直す。
function drawLatestSegment(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number) {
  const n = stroke.length;
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (n < 3) {
    ctx.moveTo(stroke[0].x, stroke[0].y);
    ctx.lineTo(stroke[n - 1].x, stroke[n - 1].y);
  } else {
    const start = midpoint(stroke[n - 3], stroke[n - 2]);
    const end = midpoint(stroke[n - 2], stroke[n - 1]);
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(stroke[n - 2].x, stroke[n - 2].y, end.x, end.y);
  }
  ctx.stroke();
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function strokeHits(stroke: Stroke, p: Point, radius: number) {
  if (stroke.length === 1) return Math.hypot(stroke[0].x - p.x, stroke[0].y - p.y) <= radius;
  for (let i = 1; i < stroke.length; i++) {
    if (distanceToSegment(p, stroke[i - 1], stroke[i]) <= radius) return true;
  }
  return false;
}

function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function exportStrokes(strokes: Stroke[]): string | undefined {
  if (strokes.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const contentWidth = maxX - minX + EXPORT_PADDING * 2;
  const contentHeight = maxY - minY + EXPORT_PADDING * 2;
  // 小さく書いた字も読みやすいよう最大2倍まで拡大し、AIに送れる大きさ以内に収める。
  const scale = Math.min(2, EXPORT_MAX_SIDE / Math.max(contentWidth, contentHeight));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(contentWidth * scale));
  canvas.height = Math.max(1, Math.round(contentHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, (EXPORT_PADDING - minX) * scale, (EXPORT_PADDING - minY) * scale);
  // 縮小しても線がかすれないよう、出力時は線を少し太くする。
  const width = Math.max(PEN_WIDTH, 2.4 / scale);
  for (const stroke of strokes) drawStroke(ctx, stroke, width);
  return canvas.toDataURL("image/png");
}
