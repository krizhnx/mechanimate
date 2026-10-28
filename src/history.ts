import { useCallback, useState } from "react";
import type { SceneSpec, SolveMeta } from "./shared/types";

export interface HistoryItem {
  id: string;
  spec: SceneSpec;
  meta: SolveMeta;
  image?: string;
  createdAt: number;
}

const KEY = "mechanimate.history.v1";
const MAX = 12;

function load(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // quota exceeded: drop images and retry
    try {
      localStorage.setItem(KEY, JSON.stringify(items.map((i) => ({ ...i, image: undefined }))));
    } catch {
      /* give up silently */
    }
  }
}

/** Solved questions persist locally so they can be re-opened instantly (no extra API calls during a demo). */
export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>(load);
  const add = useCallback((spec: SceneSpec, meta: SolveMeta, image?: string) => {
    const item: HistoryItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, spec, meta, image, createdAt: Date.now() };
    setItems((prev) => {
      const next = [item, ...prev].slice(0, MAX);
      save(next);
      return next;
    });
    return item.id;
  }, []);
  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      save(next);
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setItems([]);
    save([]);
  }, []);
  return { items, add, remove, clear };
}

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
