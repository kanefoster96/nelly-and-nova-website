"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number }; // 0–1, relative to the pad
type Stroke = Point[];

const INK = "#f5f2ea"; // what you see while signing (paper on the dark pad)
const EXPORT_INK = "#111111"; // the saved signature: dark ink on white, like paper
const LINE_WIDTH = 2.5;
const EXPORT_W = 900;
const EXPORT_H = 300;

/**
 * Inline signature pad (drawn right in the form, like the Kanvas waiver)
 * with the problems of the old pop-up version fixed:
 *
 * - The page doesn't scroll or bounce while you sign: the pad claims the
 *   touch (`touch-action: none`) and holds on to the pointer until you lift.
 * - Rotating the phone or resizing the window redraws what you've signed
 *   instead of wiping or stretching it. Strokes are kept as points relative
 *   to the pad and redrawn at the new size.
 * - A single tap leaves a dot (initials, full stops).
 * - An interrupted touch (iOS pointercancel) still keeps the stroke.
 *
 * `value` is the saved signature as a PNG data URL: dark ink on a white
 * background, so it reads properly on an email or a printed copy. Once
 * signed, the pad shows that image with a "Sign again" button.
 */
export function SignaturePad({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  invalid?: boolean;
}) {
  const [editing, setEditing] = useState(!value);
  // Show the pad again whenever the signature is cleared from outside (e.g. Start over).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!value) setEditing(true);
  }

  if (!editing && value) {
    return (
      <div>
        <div className="rounded-lg border border-white/10 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Your signature" className="mx-auto h-24 w-full object-contain" />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-emerald-300">Signature captured ✓</p>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setEditing(true);
            }}
            className="text-xs text-paper-dim underline underline-offset-2 hover:text-paper"
          >
            Sign again
          </button>
        </div>
      </div>
    );
  }

  return <DrawingPad onChange={onChange} invalid={invalid} />;
}

function DrawingPad({ onChange, invalid }: { onChange: (dataUrl: string) => void; invalid: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const active = useRef<{ id: number; stroke: Stroke } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  /** Draw every stroke onto a context sized w×h (CSS pixels). */
  const paint = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0].x * w, s[0].y * h, width / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s[0].x * w, s[0].y * h);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x * w, s[i].y * h);
      ctx.stroke();
    }
  }, []);

  /** Match the canvas buffer to its on-screen size (and pixel density), then redraw. */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * ratio);
    const h = Math.round(rect.height * ratio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    paint(ctx, rect.width, rect.height, INK, LINE_WIDTH);
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redraw();
    const ro = new ResizeObserver(() => redraw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  function point(e: React.PointerEvent<HTMLCanvasElement> | PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    // One finger/pen at a time; ignore a second touch mid-stroke.
    if (active.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: Stroke = [point(e)];
    active.current = { id: e.pointerId, stroke };
    strokes.current.push(stroke);
    redraw();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const cur = active.current;
    if (!cur || cur.id !== e.pointerId) return;
    e.preventDefault();
    // Coalesced events give a smoother line on fast strokes where supported.
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e.nativeEvent]) cur.stroke.push(point(ev));
    redraw();
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    const cur = active.current;
    if (!cur || cur.id !== e.pointerId) return;
    active.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setHasInk(true);
    onChange(exportPng());
  }

  /** Dark ink on white at a fixed size, whatever size the pad was on screen. */
  function exportPng(): string {
    const out = document.createElement("canvas");
    out.width = EXPORT_W;
    out.height = EXPORT_H;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    paint(ctx, EXPORT_W, EXPORT_H, EXPORT_INK, LINE_WIDTH * (EXPORT_W / 400));
    return out.toDataURL("image/png");
  }

  function clear() {
    strokes.current = [];
    active.current = null;
    setHasInk(false);
    redraw();
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Signature pad — draw your signature with your finger or mouse"
        role="img"
        className={`block h-44 w-full cursor-crosshair touch-none select-none overscroll-contain rounded-lg border bg-ink ${
          invalid ? "border-red-400/60" : "border-white/10"
        }`}
        style={{ touchAction: "none", WebkitUserSelect: "none" }}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-paper-dim">{hasInk ? "Signature captured ✓" : "Draw your signature above"}</p>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="text-xs text-paper-dim underline underline-offset-2 hover:text-paper disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
