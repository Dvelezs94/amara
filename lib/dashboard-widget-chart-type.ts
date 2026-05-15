export type DashboardWidgetChartType = "line" | "bar" | "pie";

const ALLOWED: DashboardWidgetChartType[] = ["line", "bar", "pie"];

export function parseChartTypeFromRequest(value: unknown): DashboardWidgetChartType {
  if (value === "line" || value === "bar" || value === "pie") return value;
  return "line";
}

/**
 * Applies saved `chartType` for a widget, falling back to sensible defaults when
 * missing or incompatible with `fieldType` / number of selected fields.
 */
export function clampWidgetChartType(
  saved: string | null | undefined,
  fieldType: string | null,
  labelCount: number
): DashboardWidgetChartType {
  const valid = ALLOWED.includes(saved as DashboardWidgetChartType)
    ? (saved as DashboardWidgetChartType)
    : null;

  if (fieldType === "number") {
    if (valid === "line" || valid === "bar") return valid;
    return "line";
  }
  if (fieldType === "checkbox") {
    if (labelCount > 1) return "bar";
    if (valid === "bar" || valid === "pie") return valid;
    return "pie";
  }
  if (fieldType === "dropdown" || fieldType === "text") {
    if (labelCount > 1) return "bar";
    if (valid === "bar" || valid === "pie") return valid;
    return "bar";
  }
  return "line";
}
