"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import {
  DOCS_BASE_PATH,
  DOCS_SECTIONS,
  docsHref,
  type DocsSectionSlug,
} from "@/lib/docs-guide";

export function DocsChrome({
  children,
  activeSlug,
}: {
  children: ReactNode;
  activeSlug?: DocsSectionSlug | null;
}) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:w-64">
        <Link
          href={DOCS_BASE_PATH}
          className="mb-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Guía MSA
        </Link>
        <nav className="space-y-0.5" aria-label="Capítulos de la documentación">
          {DOCS_SECTIONS.map((section) => {
            const href = docsHref(section.slug);
            const active =
              activeSlug === section.slug || pathname === href;
            return (
              <Link
                key={section.slug}
                href={href}
                className={`flex items-start gap-2 rounded-lg px-2 py-2 text-sm ${
                  active
                    ? "bg-accent-50 font-medium text-accent-800"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <ChevronRight
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    active ? "text-accent-600" : "text-zinc-300"
                  }`}
                  aria-hidden
                />
                <span>
                  <span className="block leading-snug">{section.title}</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                    {section.summary}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}

export function DocsCallout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-xl border border-accent-200 bg-accent-50/80 px-4 py-3 text-sm text-accent-950">
      <p className="font-semibold text-accent-800">{title}</p>
      <div className="mt-1 text-accent-900/90">{children}</div>
    </aside>
  );
}

export function DocsSteps({
  steps,
}: {
  steps: { title: string; detail: string }[];
}) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-zinc-900">{step.title}</p>
            <p className="mt-0.5 text-sm text-zinc-600">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
