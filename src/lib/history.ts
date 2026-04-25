// Undo/redo history. Stores immutable snapshots of the scene. Keeps the last
// 50 snapshots — enough for a long editing session, cheap on memory because
// JSON.stringify-then-clone happens only when state actually changes.

import { useCallback, useRef, useState } from "react";

export interface Snapshot<T> {
  state: T;
  /** A short label so we could show the action in a UI later */
  label: string;
  at: number;
}

const MAX_HISTORY = 50;

/**
 * useHistory wraps a state value with undo/redo. Call `push(label)` AFTER you
 * mutate state and want the new value memorialized. The hook intentionally
 * does not auto-snapshot every state change so we can group rapid drags into
 * a single entry.
 */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<Snapshot<T>[]>([]);
  const future = useRef<Snapshot<T>[]>([]);
  const [version, setVersion] = useState(0);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setPresent((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next));
  }, []);

  const commit = useCallback(
    (label: string) => {
      setPresent((prev) => {
        const last = past.current[past.current.length - 1];
        // Skip no-ops
        if (last && JSON.stringify(last.state) === JSON.stringify(prev)) return prev;
        past.current.push({ state: structuredClone(prev), label, at: Date.now() });
        if (past.current.length > MAX_HISTORY) past.current.shift();
        future.current = [];
        setVersion((v) => v + 1);
        return prev;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setPresent((curr) => {
      const snap = past.current.pop()!;
      future.current.push({ state: structuredClone(curr), label: snap.label, at: Date.now() });
      setVersion((v) => v + 1);
      return snap.state;
    });
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setPresent((curr) => {
      const snap = future.current.pop()!;
      past.current.push({ state: structuredClone(curr), label: snap.label, at: Date.now() });
      setVersion((v) => v + 1);
      return snap.state;
    });
  }, []);

  return {
    state: present,
    set,
    commit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    /** rerender token so consumers can show counts */
    version,
  };
}
