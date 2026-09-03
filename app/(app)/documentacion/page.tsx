import Image from "next/image";
import Link from "next/link";
import { SetPageHeader } from "@/components/SetPageHeader";
import {
  DOCS_SECTIONS,
  docsHref,
} from "@/lib/docs-guide";
import { DocsChrome } from "./DocsChrome";

export default function DocumentacionHubPage() {
  return (
    <>
      <SetPageHeader
        title="Documentación"
        subtitle="Guía de MSA (web y móvil) en español"
      />
      <DocsChrome>
        <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="relative h-44 w-full bg-zinc-100 sm:h-56">
            <Image
              src="/docs/hero-msa.png"
              alt="Ilustración de MSA en escritorio y celular"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 800px"
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Guía de uso de MSA
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              MSA (Maintenance Software / Support Assistant) es el sistema de
              mantenimiento de AMISSA. Desde la web administras la planta;
              desde la app Android los técnicos trabajan las tareas del día.
              Esta guía resume pantallas, flujos y permisos con ejemplos
              visuales (datos de muestra, no en vivo).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {DOCS_SECTIONS.map((section) => (
                <Link
                  key={section.slug}
                  href={docsHref(section.slug)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-primary-200 hover:bg-primary-50/40"
                >
                  <p className="font-semibold text-zinc-900">{section.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{section.summary}</p>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </DocsChrome>
    </>
  );
}
