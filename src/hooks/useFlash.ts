import { useState, useCallback, useRef } from "react";
import { FLASH_CONFIG } from "../config/flashConfig.js";

export function useFlash() {
  const [flashingIds, setFlashingIds] = useState<Set<string | number>>(
    new Set()
  );
  const timersRef = useRef<Map<string | number, NodeJS.Timeout[]>>(new Map());

  const startFlash = useCallback((id: string | number, count?: number) => {
    const flashCount = count ?? FLASH_CONFIG.chatFlashCount;

    // Clear existing timers (handles restart)
    const existing = timersRef.current.get(id);
    existing?.forEach(clearTimeout);

    const timers: NodeJS.Timeout[] = [];
    const cycleDuration = FLASH_CONFIG.onDuration + FLASH_CONFIG.offDuration;

    for (let i = 0; i < flashCount; i++) {
      // Turn ON
      timers.push(
        setTimeout(() => {
          setFlashingIds((prev) => new Set(prev).add(id));
        }, i * cycleDuration)
      );

      // Turn OFF
      timers.push(
        setTimeout(() => {
          setFlashingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, i * cycleDuration + FLASH_CONFIG.onDuration)
      );
    }

    timersRef.current.set(id, timers);
  }, []);

  const stopFlash = useCallback((id: string | number) => {
    const timers = timersRef.current.get(id);
    timers?.forEach(clearTimeout);
    timersRef.current.delete(id);
    setFlashingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isFlashing = useCallback(
    (id: string | number) => {
      return flashingIds.has(id);
    },
    [flashingIds]
  );

  return { startFlash, stopFlash, isFlashing };
}
