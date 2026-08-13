"use client";

import { useRef } from "react";
import { PlusIcon } from "./Icons";

/**
 * Round dog-photo picker. Reads the chosen file as a data URL (so it survives
 * a page handoff via sessionStorage and can be previewed immediately) and hands
 * it back through `onSelect`. The actual upload to Supabase Storage happens in
 * lib/storage/photos.ts when the account is saved.
 */
export function AvatarUpload({
  value,
  onSelect,
  size = 112,
  label = "Add photo",
}: {
  value: string | null;
  onSelect: (dataUrl: string) => void;
  size?: number;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function onChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSelect(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label="Add a photo of your dog"
        className={`group relative overflow-hidden rounded-full transition-colors hover:ring-2 hover:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          value ? "" : "ring-2 ring-white/15"
        }`}
        style={{ height: size, width: size }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/[0.04] text-paper-dim">
            <PlusIcon width={22} height={22} />
            <span className="text-[11px] font-medium uppercase tracking-wide">
              {label}
            </span>
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
