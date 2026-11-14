"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

// The one dialog shell every sheet in the app uses. While it's open:
//   - keyboard focus moves into it and can't Tab out,
//   - everything behind it is inert (can't be clicked, tabbed to, or read),
//   - Escape closes it,
//   - on close, focus returns to the button that opened it.
// On a phone it's a bottom sheet; on wider screens a centered dialog.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name, or the id of the heading that names it. */
  label?: string;
  labelledBy?: string;
  role?: "dialog" | "alertdialog";
  /** Element to focus on open. Defaults to the first control in the sheet. */
  initialFocus?: RefObject<HTMLElement>;
  size?: "sm" | "md";
  /** Extra classes for the panel (e.g. to remove padding). */
  panelClassName?: string;
  children: ReactNode;
}

export function Sheet({
  open,
  onClose,
  label,
  labelledBy,
  role = "dialog",
  initialFocus,
  size = "md",
  panelClassName = "p-5",
  children,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A container of our own on <body>, so the rest of the page can be made inert.
  useEffect(() => {
    const host = document.createElement("div");
    host.setAttribute("data-sheet-host", "");
    document.body.appendChild(host);
    hostRef.current = host;
    setMounted(true);
    return () => {
      host.remove();
      hostRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open || !hostRef.current) return;
    const host = hostRef.current;
    const opener = document.activeElement as HTMLElement | null;

    // Make everything else on the page inert (including any sheet underneath).
    const silenced: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === host || el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
      silenced.push(el);
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus inside once the panel exists.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = initialFocus?.current ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey, true);
      for (const el of silenced) el.removeAttribute("inert");
      document.body.style.overflow = prevOverflow;
      // Back to whatever opened the sheet, if it's still on the page.
      if (opener && document.contains(opener)) {
        window.setTimeout(() => opener.focus({ preventScroll: true }), 0);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  if (!mounted || !hostRef.current) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-maroon-900/45 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-label={label}
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={`flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-3xl bg-cream-50 pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none ring-1 ring-maroon-900/10 sm:rounded-3xl ${
              size === "sm" ? "max-w-sm" : "max-w-md"
            } ${panelClassName}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    hostRef.current,
  );
}

// The standard title row: heading, optional sub-line, and a 44px Close button.
export function SheetHeader({
  id,
  title,
  sub,
  onClose,
}: {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-xl font-bold text-maroon-800">
          {title}
        </h2>
        {sub && <div className="mt-0.5 text-sm text-maroon-900/80">{sub}</div>}
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-maroon-900/75 hover:bg-cream-200"
      >
        ✕
      </button>
    </div>
  );
}
