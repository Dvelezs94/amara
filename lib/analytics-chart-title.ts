export type AnalyticsChartTitlePreset =
  | "number-time"
  | "categorical-multi"
  | "categorical-single"
  | "categorical-daily"
  | "checkbox-multi"
  | "checkbox-single"
  | "date";

export function inferAnalyticsChartTitlePreset(
  fieldType: string | null,
  labelCount: number,
  chartType?: string | null
): AnalyticsChartTitlePreset | null {
  if (!fieldType || labelCount === 0) return null;
  if (fieldType === "number") return "number-time";
  if (fieldType === "dropdown" || fieldType === "text") {
    if (labelCount > 1) return "categorical-multi";
    if (chartType === "stacked") return "categorical-daily";
    return "categorical-single";
  }
  if (fieldType === "checkbox") {
    return labelCount > 1 ? "checkbox-multi" : "checkbox-single";
  }
  if (fieldType === "date") return "date";
  return null;
}

export function buildDefaultAnalyticsChartTitle(
  labels: readonly string[],
  preset: AnalyticsChartTitlePreset
): string {
  const joined = labels.join(", ");
  switch (preset) {
    case "number-time":
      return `${joined} en el tiempo (punto por orden)`;
    case "categorical-multi":
      return `${joined} — comparación por categoría`;
    case "categorical-single":
      return `${labels[0] ?? joined} — distribución`;
    case "categorical-daily":
      return `${labels[0] ?? joined} — por día`;
    case "checkbox-multi":
      return `${joined} — sí / no por campo`;
    case "checkbox-single":
      return `${labels[0] ?? joined} — sí / no`;
    case "date":
      return joined;
  }
}

export function analyticsChartTitleStorageKey(
  templateId: string,
  labels: readonly string[]
): string {
  return `msa-analytics-chart-title:${templateId}:${labels.join("|")}`;
}

export function loadChartTitleFromStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function saveChartTitleToStorage(key: string, title: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = title.trim();
    if (!trimmed) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, trimmed);
  } catch {
    /* ignore quota */
  }
}
