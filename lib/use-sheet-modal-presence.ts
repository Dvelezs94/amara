"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const CLOSE_FALLBACK_MS = 360;

/** Keeps the overlay mounted through exit so transform transitions can finish. */
export function useSheetModalPresence(isOpen: boolean) {
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    if (isOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
  }, [isOpen]);

  const onPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== "transform") return;
      if (!isOpen) setMounted(false);
    },
    [isOpen]
  );

  useEffect(() => {
    if (isOpen || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [isOpen, mounted]);

  return { mounted, show, onPanelTransitionEnd };
}
