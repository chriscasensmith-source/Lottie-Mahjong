"use client";

import { useCallback, useEffect, useState } from "react";

// Per-hand freeform notes, stored on-device (localStorage). Notes are personal
// reminders ("good when I have lots of flowers", etc.) and don't need syncing.
const NOTES_KEY = "mahjong_hand_notes";

type Notes = Record<string, string>;

export function useNotes() {
  const [notes, setNotes] = useState<Notes>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTES_KEY);
      if (raw) setNotes(JSON.parse(raw) as Notes);
    } catch {
      /* ignore */
    }
  }, []);

  const setNote = useCallback((handId: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[handId] = text;
      else delete next[handId];
      try {
        window.localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { notes, setNote };
}
