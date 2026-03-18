"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Package,
  MessageSquarePlus,
  ListChecks,
  BarChart2,
  LayoutDashboard,
  BookOpen,
  Bot,
  User,
  Menu,
  X,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { SessionUser } from "@/lib/auth";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ask", label: "Asistente", icon: Bot },
  { href: "/work-orders", label: "Órdenes de trabajo", icon: ClipboardList },
  { href: "/assets", label: "Activos", icon: Package },
  { href: "/knowledge-base", label: "Base de conocimiento", icon: BookOpen },
  { href: "/checklists", label: "Checklist", icon: ListChecks },
  { href: "/requests", label: "Solicitudes", icon: MessageSquarePlus },
  { href: "/analytics", label: "Analíticas", icon: BarChart2 },
];

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileDesktopRef = useRef<HTMLDivElement>(null);
  const profileMobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideDesktop = profileDesktopRef.current?.contains(target);
      const insideMobile = profileMobileRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) setProfileMenuOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [profileMenuOpen]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-zinc-200">
        <div className="flex items-center h-14 px-4 border-b border-zinc-200">
          <Link href="/work-orders" className="font-semibold text-zinc-900">
            AmiMaint
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {mainNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium tap-target ${
                pathname.startsWith(href)
                  ? "bg-primary-50 text-primary-700"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-200" ref={profileDesktopRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium tap-target ${
              pathname.startsWith("/profile") || profileMenuOpen
                ? "bg-primary-50 text-primary-700"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <span className="flex items-center gap-3">
              <User className="h-5 w-5 shrink-0" />
              Perfil
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
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-zinc-200 transform transition-transform md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-200">
          <span className="font-semibold text-zinc-900">Menú</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-zinc-100 tap-target"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {mainNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium tap-target ${
                pathname.startsWith(href)
                  ? "bg-primary-50 text-primary-700"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-200">
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium tap-target ${
              pathname.startsWith("/profile") || profileMenuOpen
                ? "bg-primary-50 text-primary-700"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <span className="flex items-center gap-3">
              <User className="h-5 w-5 shrink-0" />
              Perfil
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
      <div className="flex-1 flex flex-col md:pl-56 min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 px-4 bg-white/95 backdrop-blur border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 tap-target md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5 text-zinc-600" />
          </button>
          <Link href="/work-orders" className="md:hidden font-semibold text-zinc-900">
            AmiMaint
          </Link>
        </header>

        <main className="flex-1 p-4 pb-24 md:pb-4 md:max-w-app md:w-full md:mx-auto">
          {children}
        </main>

        {/* Bottom nav (mobile only) */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 bg-white border-t border-zinc-200 md:hidden">
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
              <User className="h-6 w-6 shrink-0" />
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
