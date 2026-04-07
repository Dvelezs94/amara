"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  ListChecks,
  BarChart2,
  CalendarDays,
  LayoutDashboard,
  BookOpen,
  User,
  Menu,
  X,
  Settings,
  LogOut,
  ChevronDown,
  Wrench,
  ArrowLeft,
  Bell,
  Search,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { SessionUser } from "@/lib/auth-shared";
import { UserAvatar } from "@/components/UserAvatar";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const baseNavSections: { type: string; items: NavItem[] }[] = [
  {
    type: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    type: "Operaciones",
    items: [
      { href: "/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/tareas", label: "Tareas", icon: ClipboardList },
      { href: "/checklists", label: "Checklist", icon: ListChecks },
      { href: "/assets", label: "Maquinas", icon: Wrench },
    ],
  },
  {
    type: "Contenido",
    items: [{ href: "/knowledge-base", label: "Base de conocimiento", icon: BookOpen }],
  },
  {
    type: "Reportes",
    items: [{ href: "/analytics", label: "Analíticas", icon: BarChart2 }],
  },
];

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "operator") return "Operador";
  return role;
}

function ProfileSubmenu({
  onClose,
  inBottomBar,
}: {
  onClose: () => void;
  inBottomBar?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ${
        inBottomBar ? "min-w-[180px]" : "w-full"
      }`}
    >
      <Link
        href="/profile"
        onClick={onClose}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 tap-target"
      >
        <Settings className="h-4 w-4 shrink-0" />
        Ajustes
      </Link>
      <form action="/api/auth/logout" method="POST" className="border-t border-zinc-100">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100 tap-target"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userRole = roleLabel(user.role);
  const navSections = [
    ...(user.role === "admin"
      ? baseNavSections
      : [
          {
            type: "Operaciones",
            items: [
              {
                href: "/tareas",
                label: "Tareas",
                icon: ClipboardList,
              } satisfies NavItem,
            ],
          },
          {
            type: "Contenido",
            items: [
              {
                href: "/knowledge-base",
                label: "Base de conocimiento",
                icon: BookOpen,
              } satisfies NavItem,
            ],
          },
        ]),
    ...(user.role === "admin"
      ? [
          {
            type: "Plataforma",
            items: [
              {
                href: "/logs",
                label: "Logs de plataforma",
                icon: BarChart2,
              } satisfies NavItem,
              {
                href: "/users",
                label: "Usuarios",
                icon: User,
              } satisfies NavItem,
            ],
          },
        ]
      : []),
  ];
  const mainNav = navSections.flatMap((s) => s.items);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      body: string | null;
      type: "assignment" | "work_order_update" | "mention";
      workOrderId: string | null;
      readAt: string | null;
      createdAt: string;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const showBackButton =
    pathname.startsWith("/tareas") ||
    pathname.startsWith("/checklists") ||
    pathname.startsWith("/assets");

  const profileDesktopRef = useRef<HTMLDivElement>(null);
  const profileMobileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!profileMenuOpen && !notificationsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideDesktop = profileDesktopRef.current?.contains(target);
      const insideMobile = profileMobileRef.current?.contains(target);
      const insideNotifications = notificationsRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) setProfileMenuOpen(false);
      if (!insideNotifications) setNotificationsOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [profileMenuOpen, notificationsOpen]);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      setNotificationsLoading(true);
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setNotifications(Array.isArray(data.items) ? data.items : []);
          setUnreadCount(Number(data.unreadCount ?? 0));
        }
      } finally {
        if (!cancelled) setNotificationsLoading(false);
      }
    }
    void loadNotifications();
    const timer = setInterval(() => {
      void loadNotifications();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function submitSearch() {
    const q = searchQuery.trim();
    const targetBase = pathname.startsWith("/knowledge-base")
      ? "/knowledge-base"
      : "/tareas";
    if (!q) {
      router.push(targetBase);
      return;
    }
    router.push(`${targetBase}?q=${encodeURIComponent(q)}`);
  }

  async function markAllNotificationsRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );
    setUnreadCount(0);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 bg-[#091523] border-r border-[#1a2a3f]">
        <div className="flex h-24 flex-col justify-center px-6 border-b border-[#1a2a3f]">
          <Link href="/tareas" className="text-[33px] font-bold uppercase tracking-tight text-[#f4b281] leading-none">
            MSA
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[#7890af]">Maintenance Support Assistant</p>
        </div>
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-6">
          {navSections.map((section) => (
            <div key={section.type}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6580a2]">
                {section.type}
              </p>
              <div className="space-y-1">
                {section.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] tap-target ${
                      pathname.startsWith(href)
                        ? "bg-[#efac78] text-[#0d1728]"
                        : "text-[#9fb1c9] hover:bg-[#102137]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1a2a3f]" ref={profileDesktopRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium tap-target ${
              pathname.startsWith("/profile") || profileMenuOpen
                ? "bg-[#efac78] text-[#0d1728]"
                : "text-[#9fb1c9] hover:bg-[#102137]"
            }`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar
                userId={user.id}
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="sm"
              />
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate">Perfil</span>
                <span className="truncate text-xs font-normal text-[#6f85a3]">
                  {user.name} · {userRole}
                </span>
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {profileMenuOpen && (
            <div className="mt-1 pl-2">
              <ProfileSubmenu onClose={() => setProfileMenuOpen(false)} />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#091523] border-r border-[#1a2a3f] transform transition-transform md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#1a2a3f]">
          <span className="font-semibold text-[#f4b281]">Menú</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-[#102137] tap-target"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto space-y-6">
          {navSections.map((section) => (
            <div key={section.type}>
              <p className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#6580a2]">
                {section.type}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] tap-target ${
                      pathname.startsWith(href)
                        ? "bg-[#efac78] text-[#0d1728]"
                        : "text-[#9fb1c9] hover:bg-[#102137]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1a2a3f]">
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium tap-target ${
              pathname.startsWith("/profile") || profileMenuOpen
                ? "bg-[#efac78] text-[#0d1728]"
                : "text-[#9fb1c9] hover:bg-[#102137]"
            }`}
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar
                userId={user.id}
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="sm"
              />
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="truncate">Perfil</span>
                <span className="truncate text-xs font-normal text-[#6f85a3]">
                  {user.name} · {userRole}
                </span>
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {profileMenuOpen && (
            <div className="mt-1 pl-2">
              <ProfileSubmenu
                onClose={() => {
                  setProfileMenuOpen(false);
                  setSidebarOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:pl-[260px] min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 bg-[#061321]/95 backdrop-blur border-b border-[#1a2a3f]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-[#102137] tap-target md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5 text-[#9fb1c9]" />
          </button>
          {showBackButton && (
            <button
              type="button"
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-[#102137] tap-target"
              aria-label="Volver"
            >
              <ArrowLeft className="h-5 w-5 text-[#9fb1c9]" />
            </button>
          )}
          <Link href="/tareas" className="md:hidden font-semibold text-[#f4b281]">
            AmiMaint
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-md border border-[#1a2a3f] bg-[#0b1a2d] px-3 py-2 min-w-[260px]">
              <Search className="h-4 w-4 text-[#6f85a3]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSearch();
                  }
                }}
                aria-label="Buscar"
                className="w-full bg-transparent border-0 p-0 text-xs text-[#9fb1c9] placeholder:text-[#6f85a3] focus:outline-none"
                placeholder={
                  pathname.startsWith("/knowledge-base")
                    ? "Buscar en base de conocimiento..."
                    : "Buscar tareas..."
                }
              />
            </div>
            <button
              type="button"
              onClick={submitSearch}
              className="hidden md:inline-flex items-center justify-center rounded-md border border-[#1a2a3f] bg-[#0b1a2d] p-2 text-[#9fb1c9] hover:bg-[#102137]"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="relative hidden md:block" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-md border border-[#1a2a3f] bg-[#0b1a2d] p-2 text-[#9fb1c9] hover:bg-[#102137]"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#efac78] px-1 text-[10px] font-bold text-[#0d1728]">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 z-40 mt-2 w-80 rounded-md border border-[#1a2a3f] bg-[#0b1a2d] shadow-lg">
                  <div className="flex items-center justify-between border-b border-[#1a2a3f] px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9fb1c9]">
                      Notificaciones
                    </p>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-medium text-[#efac78] hover:underline"
                    >
                      Marcar todo leido
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notificationsLoading ? (
                      <p className="px-2 py-3 text-xs text-[#7890af]">Cargando...</p>
                    ) : notifications.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-[#7890af]">Sin notificaciones</p>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.workOrderId ? `/tareas/${n.workOrderId}` : "/tareas"}
                          onClick={async () => {
                            await fetch(`/api/notifications/${n.id}`, {
                              method: "PATCH",
                            });
                            setNotifications((prev) =>
                              prev.map((item) =>
                                item.id === n.id
                                  ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
                                  : item
                              )
                            );
                            setUnreadCount((prev) => Math.max(0, prev - (n.readAt ? 0 : 1)));
                            setNotificationsOpen(false);
                          }}
                          className={`mb-1 block rounded-md border px-2 py-2 text-xs ${
                            n.readAt
                              ? "border-[#1a2a3f] text-[#7890af]"
                              : "border-[#2a3e5a] bg-[#102137] text-[#d4deee]"
                          }`}
                        >
                          <p className="font-semibold">{n.title}</p>
                          {n.body && <p className="mt-0.5 truncate">{n.body}</p>}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:pb-4 md:max-w-none md:w-full md:mx-auto">
          {children}
        </main>

        {/* Bottom nav (mobile only) */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 bg-[#091523] border-t border-[#1a2a3f] md:hidden">
          {mainNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-medium tap-target ${
                pathname.startsWith(href)
                  ? "text-primary-600"
                  : "text-zinc-500"
              }`}
            >
              <Icon className="h-6 w-6 shrink-0" />
              {label}
            </Link>
          ))}
          <div className="flex flex-1 flex-col items-center justify-center relative" ref={profileMobileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((o) => !o)}
              className={`flex flex-col items-center justify-center gap-0.5 h-full w-full text-xs font-medium tap-target ${
                pathname.startsWith("/profile") || profileMenuOpen
                  ? "text-primary-600"
                  : "text-zinc-500"
              }`}
            >
              <UserAvatar
                userId={user.id}
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="sm"
              />
              Perfil
            </button>
            {profileMenuOpen && (
              <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2">
                <ProfileSubmenu
                  inBottomBar
                  onClose={() => setProfileMenuOpen(false)}
                />
              </div>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
