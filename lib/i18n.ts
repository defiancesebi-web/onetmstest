/**
 * Lightweight i18n: a cookie holds the locale, server components read it and
 * pick a dictionary. No URL routing, so it doesn't touch the auth middleware.
 * The language switcher writes the cookie and calls router.refresh().
 *
 * This module is client-safe (no next/headers). The cookie-reading helpers live
 * in lib/i18n-server.ts so importing constants/types here never drags a
 * server-only API into the client bundle.
 */
export type Locale = "ro" | "en";
export const LOCALES: Locale[] = ["ro", "en"];
export const DEFAULT_LOCALE: Locale = "ro";
export const LOCALE_COOKIE = "locale";

export type Dictionary = {
  nav: {
    dashboard: string;
    loads: string;
    planning: string;
    dispatch: string;
    tracking: string;
    vehicles: string;
    drivers: string;
    customers: string;
    carriers: string;
    invoices: string;
    documents: string;
    reports: string;
    analytics: string;
    team: string;
    settings: string;
    collapse: string;
    expand: string;
    soon: string;
  };
  topbar: {
    search: string;
    company: string;
    platform: string;
    notifications: string;
    messages: string;
    logout: string;
    changePassword: string;
  };
  soon: { title: string; body: string };
  dashboard: {
    greeting: string;
    trialNotice: string;
    totalLoads: string;
    inTransit: string;
    delivered: string;
    revenue: string;
    margin: string;
    vsLastWeek: string;
    overview: string;
    last7days: string;
    byStatus: string;
    total: string;
    quickActions: string;
    newLoad: string;
    newCustomer: string;
    newDriver: string;
    addVehicle: string;
    newTrip: string;
    recentLoads: string;
    viewAll: string;
    noLoads: string;
    colId: string;
    colRoute: string;
    colClient: string;
    colStatus: string;
    liveMap: string;
    mapSoon: string;
  };
};

const dictionaries: Record<Locale, Dictionary> = {
  ro: {
    nav: {
      dashboard: "Tablou de bord",
      loads: "Comenzi",
      planning: "Planificare",
      dispatch: "Dispecerat",
      tracking: "Urmărire",
      vehicles: "Flotă",
      drivers: "Șoferi",
      customers: "Clienți",
      carriers: "Transportatori",
      invoices: "Facturi",
      documents: "Documente",
      reports: "Rapoarte",
      analytics: "Analiză",
      team: "Echipă",
      settings: "Setări",
      collapse: "Restrânge",
      expand: "Extinde",
      soon: "în curând",
    },
    topbar: {
      search: "Caută comenzi, camioane, șoferi, locații…",
      company: "Companie",
      platform: "Platformă",
      notifications: "Notificări",
      messages: "Mesaje",
      logout: "Delogare",
      changePassword: "Schimbă parola",
    },
    soon: {
      title: "În curând",
      body: "Acest modul face parte din design și va fi construit într-o etapă următoare.",
    },
    dashboard: {
      greeting: "Bine ai venit",
      trialNotice: "Firma ta este în așteptare de activare. Vei fi contactat în curând.",
      totalLoads: "Total comenzi",
      inTransit: "În execuție",
      delivered: "Livrate",
      revenue: "Venit total",
      margin: "Marjă medie",
      vsLastWeek: "din toate comenzile",
      overview: "Evoluția comenzilor",
      last7days: "Ultimele 7 zile",
      byStatus: "Comenzi după status",
      total: "Total",
      quickActions: "Acțiuni rapide",
      newLoad: "Comandă nouă",
      newCustomer: "Client nou",
      newDriver: "Șofer nou",
      addVehicle: "Adaugă vehicul",
      newTrip: "Cursă nouă",
      recentLoads: "Comenzi recente",
      viewAll: "Vezi toate",
      noLoads: "Nicio comandă încă.",
      colId: "Comandă",
      colRoute: "Rută",
      colClient: "Client",
      colStatus: "Status",
      liveMap: "Hartă live",
      mapSoon: "Harta live sosește cu modulul de urmărire GPS.",
    },
  },
  en: {
    nav: {
      dashboard: "Dashboard",
      loads: "Loads",
      planning: "Planning",
      dispatch: "Dispatch",
      tracking: "Tracking",
      vehicles: "Vehicles",
      drivers: "Drivers",
      customers: "Customers",
      carriers: "Carriers",
      invoices: "Invoices",
      documents: "Documents",
      reports: "Reports",
      analytics: "Analytics",
      team: "Team",
      settings: "Settings",
      collapse: "Collapse",
      expand: "Expand",
      soon: "soon",
    },
    topbar: {
      search: "Search loads, vehicles, drivers, locations…",
      company: "Company",
      platform: "Platform",
      notifications: "Notifications",
      messages: "Messages",
      logout: "Log out",
      changePassword: "Change password",
    },
    soon: {
      title: "Coming soon",
      body: "This screen is part of the design and will be built in a later stage.",
    },
    dashboard: {
      greeting: "Welcome",
      trialNotice: "Your company is pending activation. We'll be in touch soon.",
      totalLoads: "Total loads",
      inTransit: "In transit",
      delivered: "Delivered",
      revenue: "Total revenue",
      margin: "Avg margin",
      vsLastWeek: "of all loads",
      overview: "Loads overview",
      last7days: "Last 7 days",
      byStatus: "Loads by status",
      total: "Total",
      quickActions: "Quick actions",
      newLoad: "New load",
      newCustomer: "New customer",
      newDriver: "New driver",
      addVehicle: "Add vehicle",
      newTrip: "New trip",
      recentLoads: "Recent loads",
      viewAll: "View all",
      noLoads: "No loads yet.",
      colId: "Load",
      colRoute: "Route",
      colClient: "Customer",
      colStatus: "Status",
      liveMap: "Live map",
      mapSoon: "The live map arrives with the GPS tracking module.",
    },
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "ro" || value === "en";
}

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
