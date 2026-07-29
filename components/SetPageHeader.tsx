"use client";

import {
  useSetPageHeader,
  type PageHeaderContent,
} from "@/components/PageHeaderContext";

/** Sets sticky AppShell title and content-toolbar filters/actions. Renders nothing. */
export function SetPageHeader({
  title,
  subtitle,
  filters,
  actions,
}: PageHeaderContent) {
  // Omit `filters` when unset so layout breadcrumbs (usePageHeaderFilters) are preserved.
  useSetPageHeader(
    filters !== undefined
      ? { title, subtitle, filters, actions }
      : { title, subtitle, actions }
  );
  return null;
}
