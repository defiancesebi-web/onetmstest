"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Menu,
  Search,
  Bell,
  TriangleAlert,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
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

  const active = items.find((it) => isActive(pathname, it.href));
  const sectionTitle = active?.label ?? "";
  const homeHref = items[0]?.href ?? "/dashboard";

  return (
    <div className="flex min-h-screen">
      {/* ---- Sidebar ---- */}
      <aside
        className={`${collapsed ? "w-[74px]" : "w-64"} text-sidebar-foreground sticky top-0 flex h-screen shrink-0 flex-col bg-[linear-gradient(180deg,#0d1c3f_0%,#0a1730_60%,#081124_100%)] transition-[width] duration-200`}
      >
        <div className="flex h-16 items-center justify-center">
          {collapsed ? (
            <Link
              href={homeHref}
              className="bg-primary grid size-9 place-items-center rounded-lg text-white"
              aria-label="ONE TMS"
            >
              <Route className="size-5" strokeWidth={2.4} />
            </Link>
          ) : (
            <Link href={homeHref} className="inline-flex flex-col items-center leading-tight">
              <span className="text-[22px] font-extrabold tracking-[0.01em] text-white">ONE</span>
              <span className="text-sidebar-foreground text-[10px] font-semibold tracking-[0.26em]">
                TMS
              </span>
            </Link>
          )}
        </div>
        {!collapsed && brandSub && (
          <p className="text-sidebar-foreground/70 -mt-1 mb-2 truncate px-4 text-xs">{brandSub}</p>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? Package;
            const on = isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={on ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  on
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "hover:bg-white/6 hover:text-white"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon className="size-[18px] shrink-0" />
                {!collapsed && (
                  <span className="flex-1 truncate">{item.label}</span>
                )}
                {!collapsed && !item.built && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${
                      on ? "bg-white/20 text-white" : "bg-white/8 text-sidebar-foreground"
                    }`}
                  >
                    {labels.soon}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hover:bg-white/6 m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:text-white"
          title={collapsed ? labels.expand : labels.collapse}
        >
          {collapsed ? (
            <ChevronsRight className="size-[18px]" />
          ) : (
            <ChevronsLeft className="size-[18px]" />
          )}
          {!collapsed && <span>{labels.collapse}</span>}
        </button>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card sticky top-0 z-10 flex h-16 items-center gap-3 border-b px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
            aria-label="Meniu"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="hidden text-base font-semibold sm:block">{sectionTitle}</h1>

          <div className="relative mx-auto hidden w-full max-w-md md:block">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              type="search"
              placeholder={labels.search}
              className="bg-muted/60 focus:bg-card h-9 w-full rounded-lg border border-transparent pl-9 pr-9 text-sm outline-none focus:border-ring"
            />
            <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-card px-1.5 text-[10px] font-medium lg:block">
              Ctrl /
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            <LanguageSwitcher locale={locale} />
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
                  <span className="bg-destructive absolute top-1 right-1 grid size-4 place-items-center rounded-full text-[10px] font-bold text-white ring-2 ring-card">
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
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-9 place-items-center rounded-lg"
              aria-label="Mesaje"
            >
              <MessageSquare className="size-5" />
            </button>

            <div className="bg-border mx-1 hidden h-8 w-px sm:block" />

            <div className="flex items-center gap-2.5">
              <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-full text-xs font-bold">
                {initials(user.name)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="text-muted-foreground block text-xs">{user.roleLabel}</span>
              </span>
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
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
