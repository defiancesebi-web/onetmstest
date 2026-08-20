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
  order: {
    back: string;
    ref: string;
    created: string;
    tabOverview: string;
    tabRoute: string;
    tabFinancial: string;
    tabEdit: string;
    tabDocuments: string;
    tabActivity: string;
    tabInvoices: string;
    info: string;
    customer: string;
    carrier: string;
    ownFleet: string;
    driver: string;
    vehicle: string;
    commodity: string;
    weight: string;
    statusTitle: string;
    cancelled: string;
    financialSummary: string;
    salePrice: string;
    ronEquiv: string;
    estCost: string;
    grossProfit: string;
    margin: string;
    price: string;
    rateUsed: string;
    rateFrom: string;
    paymentTerm: string;
    days: string;
    docsReceived: string;
    actions: string;
    trip: string;
    planOnTrip: string;
    contact: string;
    soonSuffix: string;
    soonDocuments: string;
    soonActivity: string;
    soonInvoices: string;
  };
  planning: {
    title: string;
    subtitle: string;
    truck: string;
    noTruck: string;
    unassigned: string;
    noUnassigned: string;
    plan: string;
    ordersShort: string;
    dndNote: string;
  };
  dispatch: {
    title: string;
    description: string;
    newTrip: string;
    unplanned: string;
    noUnplanned: string;
    plan: string;
    trips: string;
    allStatuses: string;
    filter: string;
    noTrips: string;
    noTruck: string;
    noOrders: string;
  };
  loads: {
    title: string;
    description: string;
    newLabel: string;
    searchPlaceholder: string;
    allStatuses: string;
    filter: string;
    notFound: string;
    colNumber: string;
    colClient: string;
    colRef: string;
    colPrice: string;
    colStatus: string;
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
    order: {
      back: "Comenzi",
      ref: "Ref",
      created: "Creată",
      tabOverview: "Prezentare",
      tabRoute: "Traseu",
      tabFinancial: "Financiar",
      tabEdit: "Editează",
      tabDocuments: "Documente",
      tabActivity: "Activitate",
      tabInvoices: "Facturi",
      info: "Informații comandă",
      customer: "Client",
      carrier: "Transportator",
      ownFleet: "Flotă proprie",
      driver: "Șofer",
      vehicle: "Camion",
      commodity: "Marfă",
      weight: "Greutate",
      statusTitle: "Stare comandă",
      cancelled: "Comandă anulată.",
      financialSummary: "Sumar financiar",
      salePrice: "Preț vânzare",
      ronEquiv: "Echivalent RON",
      estCost: "Cost estimat",
      grossProfit: "Profit brut",
      margin: "Marjă",
      price: "Preț",
      rateUsed: "Curs folosit",
      rateFrom: "din",
      paymentTerm: "Termen de plată",
      days: "zile",
      docsReceived: "Documente primite",
      actions: "Acțiuni",
      trip: "Cursa",
      planOnTrip: "Planifică pe o cursă",
      contact: "Contact",
      soonSuffix: "în curând",
      soonDocuments: "Documentele comenzii",
      soonActivity: "Istoricul activității",
      soonInvoices: "Facturile comenzii",
    },
    planning: {
      title: "Planificare",
      subtitle: "Cursele săptămânii, pe camioane. Comenzile neplanificate așteaptă în stânga.",
      truck: "Camion",
      noTruck: "Fără camion",
      unassigned: "Neplanificate",
      noUnassigned: "Nicio comandă care să aștepte un camion.",
      plan: "Planifică",
      ordersShort: "cmd.",
      dndNote:
        "Alocarea prin tragere (drag & drop) vine în pasul următor. Deocamdată, „Planifică” pe o comandă deschide formularul de cursă.",
    },
    dispatch: {
      title: "Dispecerat",
      description: "Comenzile care așteaptă un camion și cursele formate.",
      newTrip: "Cursă nouă",
      unplanned: "Comenzi neplanificate",
      noUnplanned: "Nicio comandă care să aștepte un camion.",
      plan: "Planifică",
      trips: "Curse",
      allStatuses: "Toate stările",
      filter: "Filtrează",
      noTrips: "Nicio cursă.",
      noTruck: "fără camion",
      noOrders: "fără comenzi",
    },
    loads: {
      title: "Comenzi",
      description: "Comenzile de transport primite de la clienți.",
      newLabel: "Comandă nouă",
      searchPlaceholder: "Caută după număr sau referința clientului",
      allStatuses: "Toate stările",
      filter: "Filtrează",
      notFound: "Nicio comandă găsită.",
      colNumber: "Număr",
      colClient: "Client",
      colRef: "Referință",
      colPrice: "Preț",
      colStatus: "Stare",
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
    order: {
      back: "Loads",
      ref: "Ref",
      created: "Created",
      tabOverview: "Overview",
      tabRoute: "Route",
      tabFinancial: "Financial",
      tabEdit: "Edit",
      tabDocuments: "Documents",
      tabActivity: "Activity",
      tabInvoices: "Invoices",
      info: "Order information",
      customer: "Customer",
      carrier: "Carrier",
      ownFleet: "Own fleet",
      driver: "Driver",
      vehicle: "Vehicle",
      commodity: "Commodity",
      weight: "Weight",
      statusTitle: "Order status",
      cancelled: "Order cancelled.",
      financialSummary: "Financial summary",
      salePrice: "Selling price",
      ronEquiv: "RON equivalent",
      estCost: "Estimated cost",
      grossProfit: "Gross profit",
      margin: "Margin",
      price: "Price",
      rateUsed: "Rate used",
      rateFrom: "from",
      paymentTerm: "Payment term",
      days: "days",
      docsReceived: "Documents received",
      actions: "Actions",
      trip: "Trip",
      planOnTrip: "Plan on a trip",
      contact: "Contact",
      soonSuffix: "coming soon",
      soonDocuments: "Order documents",
      soonActivity: "Activity history",
      soonInvoices: "Order invoices",
    },
    planning: {
      title: "Planning",
      subtitle: "This week's trips, by truck. Unassigned loads wait on the left.",
      truck: "Truck",
      noTruck: "No truck",
      unassigned: "Unassigned",
      noUnassigned: "No loads waiting for a truck.",
      plan: "Plan",
      ordersShort: "loads",
      dndNote:
        "Drag-and-drop assignment is coming in the next step. For now, “Plan” on a load opens the trip form.",
    },
    dispatch: {
      title: "Dispatch",
      description: "Loads waiting for a truck and the trips that carry them.",
      newTrip: "New trip",
      unplanned: "Unassigned loads",
      noUnplanned: "No loads waiting for a truck.",
      plan: "Plan",
      trips: "Trips",
      allStatuses: "All statuses",
      filter: "Filter",
      noTrips: "No trips.",
      noTruck: "no truck",
      noOrders: "no loads",
    },
    loads: {
      title: "Loads",
      description: "Transport loads received from customers.",
      newLabel: "New load",
      searchPlaceholder: "Search by number or customer reference",
      allStatuses: "All statuses",
      filter: "Filter",
      notFound: "No loads found.",
      colNumber: "Number",
      colClient: "Customer",
      colRef: "Reference",
      colPrice: "Price",
      colStatus: "Status",
    },
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "ro" || value === "en";
}

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
