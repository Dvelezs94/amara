"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_WORK_ORDER_STATUS_COLORS,
  type WorkOrderStatusColors,
} from "@/lib/work-order-status-colors";

type ContextValue = {
  colors: WorkOrderStatusColors;
  setColors: (next: WorkOrderStatusColors) => void;
  refreshColors: () => Promise<void>;
};

const WorkOrderStatusColorsContext = createContext<ContextValue>({
  colors: DEFAULT_WORK_ORDER_STATUS_COLORS,
  setColors: () => {},
  refreshColors: async () => {},
});

export function WorkOrderStatusColorsProvider({
  initialColors,
  children,
}: {
  initialColors: WorkOrderStatusColors;
  children: ReactNode;
}) {
  const [colors, setColors] = useState(initialColors);

  const refreshColors = useCallback(async () => {
    try {
      const res = await fetch("/api/app-settings/work-order-status-colors");
      if (!res.ok) return;
      const data = await res.json();
      if (data?.colors && typeof data.colors === "object") {
        setColors({ ...DEFAULT_WORK_ORDER_STATUS_COLORS, ...data.colors });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ colors, setColors, refreshColors }),
    [colors, refreshColors]
  );

  return (
    <WorkOrderStatusColorsContext.Provider value={value}>
      {children}
    </WorkOrderStatusColorsContext.Provider>
  );
}

export function useWorkOrderStatusColors() {
  return useContext(WorkOrderStatusColorsContext);
}
