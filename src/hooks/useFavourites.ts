"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "pokeverse-favourites";

export function useFavourites() {
  const [favourites, setFavourites] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setFavourites(stored ? JSON.parse(stored) : []);
    } catch {
      setFavourites([]);
    }
  }, []);

  const toggle = useCallback((id: number) => {
    setFavourites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (id: number) => favourites.includes(id),
    [favourites]
  );

  return { favourites, toggle, isFavourite };
}
