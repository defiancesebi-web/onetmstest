"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  CalendarRange,
  Route,
  Navigation,
  Truck,
  Users,
  Contact,
  Handshake,
  ReceiptText,
  FileText,
  BarChart3,
  LineChart,
  Coins,
  UserCog,
  Settings,
  Search,
  Bell,
  TriangleAlert,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions/logout";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/lib/i18n";

export type ChromeNavItem = {
  key: string;
  href: string;
  label: string;
  built: boolean;
};

export type ChromeNotification = {
  kind: string;
  severity: "critical" | "warning" | "info";
  title: string;
  subtitle?: string;
  href: string;
};

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  loads: Package,
  planning: CalendarRange,
  dispatch: Route,
  tracking: Navigation,
  vehicles: Truck,
  drivers: Users,
  customers: Contact,
  carriers: Handshake,
  invoices: ReceiptText,
  documents: FileText,
  reports: BarChart3,
  expenses: Coins,
  analytics: LineChart,
  team: UserCog,
  settings: Settings,
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function DashboardChrome({
  items,
  brandSub,
  user,
  locale,
  notifications = [],
  labels,
  children,
}: {
  items: ChromeNavItem[];
  brandSub: string;
  user: { name: string; roleLabel: string };
  locale: Locale;
  notifications?: ChromeNotification[];
  labels: {
    search: string;
    collapse: string;
    expand: string;
    soon: string;
    logout: string;
    changePassword: string;
    notifications: string;
    notificationsEmpty: string;
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // The bell reflects the current pathname's data; close the panel on navigate.
  useEffect(() => {
    setNotifOpen(false);
  }, [pathname]);

  const homeHref = items[0]?.href ?? "/dashboard";
  const newOrderLabel = locale === "ro" ? "Comandă nouă" : "New Order";

  return (
    <div className="flex min-h-screen">
      {/* ---- Sidebar (grey rail, mockup) ---- */}
      <aside
        className={`${collapsed ? "w-[74px]" : "w-[236px]"} bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 flex h-screen shrink-0 flex-col border-r transition-[width] duration-200`}
      >
        {/* Company name */}
        <div className="border-sidebar-border flex h-[60px] items-center border-b px-[18px]">
          {collapsed ? (
            <Link href={homeHref} aria-label="ONE TMS" className="mx-auto">
              <span className="text-primary text-lg font-extrabold">O</span>
            </Link>
          ) : (
            <Link
              href={homeHref}
              className="truncate text-[16px] font-bold leading-tight tracking-[-0.005em]"
              style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
              title={brandSub}
            >
              {brandSub || "ONE TMS"}
            </Link>
          )}
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2 py-2.5">
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? Package;
            const on = isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={on ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  on
                    ? "bg-white/10 text-white font-semibold"
                    : "hover:bg-white/6 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && !item.built && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                      on ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
                    }`}
                  >
                    {labels.soon}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hover:bg-white/6 mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium hover:text-white"
            title={collapsed ? labels.expand : labels.collapse}
          >
            {collapsed ? (
              <ChevronsRight className="size-[18px]" />
            ) : (
              <ChevronsLeft className="size-[18px]" />
            )}
            {!collapsed && <span>{labels.collapse}</span>}
          </button>
        </nav>

        {/* ONE logo */}
        <div className="border-sidebar-border flex items-center justify-center border-t p-4">
          <Image src="/one-logo.png" alt="ONE" width={96} height={30} className="h-[30px] w-auto" />
        </div>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-10 flex h-14 items-center gap-4 border-b px-4 sm:px-6">
          {/* Search */}
          <label className="bg-muted flex h-9 w-full max-w-[420px] items-center gap-2.5 rounded-lg border border-transparent px-3 focus-within:border-ring">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              type="search"
              placeholder={labels.search}
              className="w-full bg-transparent text-[13.5px] outline-none"
            />
          </label>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            <Link
              href="/dashboard/comenzi/noua"
              className="bg-primary hover:bg-primary/90 text-primary-foreground inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">{newOrderLabel}</span>
            </Link>

            <LanguageSwitcher locale={locale} />

            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
              aria-label="Mesaje"
            >
              <MessageSquare className="size-5" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="text-muted-foreground hover:bg-muted hover:text-foreground relative grid size-9 place-items-center rounded-lg"
                aria-label={labels.notifications}
                aria-expanded={notifOpen}
              >
                <Bell className="size-5" />
                {notifications.length > 0 && (
                  <span className="bg-destructive ring-card absolute right-1 top-1 grid size-4 place-items-center rounded-full text-[10px] font-bold text-white ring-2">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="fixed inset-0 z-20 cursor-default"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="bg-card absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border shadow-lg">
                    <div className="border-b px-4 py-2.5 text-sm font-semibold">
                      {labels.notifications}
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-muted-foreground p-4 text-sm">{labels.notificationsEmpty}</p>
                    ) : (
                      <ul className="max-h-96 overflow-y-auto py-1">
                        {notifications.map((n, i) => (
                          <li key={i}>
                            <Link
                              href={n.href}
                              onClick={() => setNotifOpen(false)}
                              className="hover:bg-muted flex items-start gap-3 px-4 py-2.5"
                            >
                              <span
                                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${
                                  n.severity === "critical"
                                    ? "bg-rose-100 text-rose-600"
                                    : n.severity === "warning"
                                      ? "bg-amber-100 text-amber-600"
                                      : "bg-blue-100 text-blue-600"
                                }`}
                              >
                                {n.severity === "info" ? (
                                  <FileText className="size-4" />
                                ) : (
                                  <TriangleAlert className="size-4" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">{n.title}</span>
                                {n.subtitle && (
                                  <span className="text-muted-foreground block text-xs tabular-nums">
                                    {n.subtitle}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <Link
              href="/parola"
              className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
              title={labels.changePassword}
              aria-label={labels.changePassword}
            >
              <Settings className="size-5" />
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
                title={labels.logout}
                aria-label={labels.logout}
              >
                <LogOut className="size-5" />
              </button>
            </form>

            {/* Avatar */}
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
              style={{ background: "#111318" }}
              title={`${user.name} · ${user.roleLabel}`}
            >
              {initials(user.name)}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
