"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageHeaderContent = {
  title?: string | null;
  subtitle?: string | null;
  /** Search / filters shown left in the content toolbar. */
  filters?: ReactNode;
  /** Primary page actions shown right in the content toolbar (not the sticky nav). */
  actions?: ReactNode;
};

type PageHeaderSetters = {
  setHeader: (next: PageHeaderContent) => void;
  clearHeader: () => void;
};

const PageHeaderStateContext = createContext<PageHeaderContent | null>(null);
const PageHeaderSettersContext = createContext<PageHeaderSetters | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderContent>({});

  const setHeader = useCallback((next: PageHeaderContent) => {
    setHeaderState(next);
  }, []);

  const clearHeader = useCallback(() => {
    setHeaderState({});
  }, []);

  const setters = useMemo(
    () => ({ setHeader, clearHeader }),
    [setHeader, clearHeader]
  );

  return (
    <PageHeaderSettersContext.Provider value={setters}>
      <PageHeaderStateContext.Provider value={header}>
        {children}
      </PageHeaderStateContext.Provider>
    </PageHeaderSettersContext.Provider>
  );
}

/** Read current sticky header content (title consumers only). */
export function usePageHeader() {
  const header = useContext(PageHeaderStateContext);
  if (header === null) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }
  return header;
}

/** Set sticky header title/actions for the lifetime of the calling component. */
export function useSetPageHeader(content: PageHeaderContent) {
  const setters = useContext(PageHeaderSettersContext);
  if (!setters) {
    throw new Error("useSetPageHeader must be used within PageHeaderProvider");
  }
  const { setHeader, clearHeader } = setters;
  const { title, subtitle, filters, actions } = content;

  useEffect(() => {
    setHeader({ title, subtitle, filters, actions });
    return () => clearHeader();
  }, [title, subtitle, filters, actions, setHeader, clearHeader]);
}

/** Longest-prefix match for default section titles in the sticky header. */
export function resolveAppShellTitle(pathname: string): string | null {
  if (pathname.endsWith("/edit")) {
    if (pathname.startsWith("/tareas/")) return "Editar tarea";
    if (pathname.startsWith("/assets/")) return "Editar máquina";
    if (pathname.includes("/revisions/")) return "Editar revisión";
  }
  if (pathname.endsWith("/revisions/new")) return "Nueva revisión";
  if (/\/checklists\/[^/]+\/revisions$/.test(pathname)) return "Revisiones";

  const rules: { prefix: string; title: string }[] = [
    { prefix: "/dashboard", title: "Dashboard" },
    { prefix: "/calendario", title: "Calendario" },
    { prefix: "/tareas/new", title: "Nueva tarea" },
    { prefix: "/tareas", title: "Tareas" },
    { prefix: "/checklists/new", title: "Nueva plantilla" },
    { prefix: "/checklists", title: "Checklist" },
    { prefix: "/assets/new", title: "Añadir máquina" },
    { prefix: "/assets", title: "Máquinas" },
    { prefix: "/knowledge-base", title: "Base de conocimiento" },
    { prefix: "/analytics", title: "Analíticas" },
    { prefix: "/users", title: "Usuarios" },
    { prefix: "/profile", title: "Perfil" },
    { prefix: "/ask", title: "Asistente" },
    { prefix: "/requests", title: "Solicitudes" },
    { prefix: "/equipo", title: "Equipo" },
    { prefix: "/logs", title: "Logs de plataforma" },
  ];
  let best: { prefix: string; title: string } | null = null;
  for (const rule of rules) {
    if (
      pathname === rule.prefix ||
      pathname.startsWith(`${rule.prefix}/`)
    ) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best?.title ?? null;
}
