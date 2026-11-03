"use client";

import { useCallback, useEffect, useState } from "react";

// Favorite hands, stored on this device next to the per-hand notes.
const FAV_KEY = "mahj_favorite_hands";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorite = useCallback((handId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(handId)) next.delete(handId);
      else next.add(handId);
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
