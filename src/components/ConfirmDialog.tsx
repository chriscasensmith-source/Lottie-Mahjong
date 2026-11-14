"use client";

import { useRef } from "react";
import { Sheet } from "@/components/Sheet";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for deleting; "plain" for ordinary confirmations. */
  tone?: "danger" | "plain";
  onConfirm: () => void;
  onCancel: () => void;
}

// "Are you sure?" The safe choice has focus by default, so a stray Enter or
// double tap never deletes or changes anything.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep it",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={open} onClose={onCancel} role="alertdialog" labelledBy="confirm-title" size="sm" initialFocus={cancelRef}>
      <h2 id="confirm-title" className="font-display text-xl font-bold text-maroon-800">
        {title}
      </h2>
      {body && <div className="mt-2 text-base text-maroon-900/85">{body}</div>}
      <div className="mt-5 flex gap-2">
        <button
          ref={cancelRef}
          onClick={onCancel}
          className="min-h-12 flex-1 rounded-full bg-cream-200 text-base font-semibold text-maroon-800 hover:bg-cream-300"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`min-h-12 flex-1 rounded-full text-base font-semibold text-white hover:brightness-95 ${
            tone === "danger" ? "bg-tile-red" : "bg-maroon-700"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
