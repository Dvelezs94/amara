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
  useSetPageHeader({ title, subtitle, filters, actions });
  return null;
}
