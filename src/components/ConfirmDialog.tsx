"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// "Are you sure?" before anything is deleted. Cancel has focus by default, so
// an accidental Enter or double tap never deletes.
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-maroon-900/40 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl bg-cream-50 p-5 shadow-2xl ring-1 ring-maroon-900/10 sm:rounded-3xl"
          >
            <h2 id="confirm-title" className="font-display text-lg font-bold text-maroon-800">
              {title}
            </h2>
            {body && <div className="mt-2 text-sm text-maroon-900/85">{body}</div>}
            <div className="mt-5 flex gap-2">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="min-h-11 flex-1 rounded-full bg-cream-200 text-sm font-semibold text-maroon-800 hover:bg-cream-300"
              >
                Keep it
              </button>
              <button
                onClick={onConfirm}
                className="min-h-11 flex-1 rounded-full bg-tile-red text-sm font-semibold text-white hover:brightness-95"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
