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
    statusFinal: string;
    cancelOrder: string;
    markAs: string;
    cancelConfirm: string;
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
  crud: {
    search: string;
    active: string;
    inactive: string;
    status: string;
    documents: string;
    days: string;
  };
  customers: {
    title: string;
    description: string;
    newLabel: string;
    searchPlaceholder: string;
    showInactive: string;
    hideInactive: string;
    notFound: string;
    colName: string;
    colCui: string;
    colCity: string;
    colPaymentTerm: string;
  };
  fleet: {
    title: string;
    description: string;
    newLabel: string;
    searchPlaceholder: string;
    showInactive: string;
    hideInactive: string;
    notFound: string;
    colNumber: string;
    colType: string;
    colMakeModel: string;
  };
  drivers: {
    title: string;
    description: string;
    newLabel: string;
    searchPlaceholder: string;
    showInactive: string;
    hideInactive: string;
    notFound: string;
    colName: string;
    colPhone: string;
  };
  orderForm: {
    back: string;
    newTitle: string;
    noClients: string;
    addFirstClient: string;
    sectionClientCargo: string;
    client: string;
    clientReference: string;
    cargoDescription: string;
    weightKg: string;
    packaging: string;
    packagingPlaceholder: string;
    sectionStops: string;
    addLoading: string;
    addUnloading: string;
    delete: string;
    address: string;
    city: string;
    contactName: string;
    phone: string;
    sectionMoney: string;
    salePrice: string;
    currency: string;
    estimatedCost: string;
    paymentTermDays: string;
    manualRate: string;
    manualRateHint: string;
    bnrRate: string;
    bnrRateFrom: string;
    ronEquivalent: string;
    save: string;
    saving: string;
    saveChanges: string;
    rateFrozenHint: string;
    notes: string;
  };
  tripForm: {
    back: string;
    newTitle: string;
    planningOrder: string;
    alreadyPlanned: string;
    cannotPlanPrefix: string;
    cannotPlanSuffix: string;
    start: string;
    end: string;
    tractor: string;
    trailer: string;
    primaryDriver: string;
    secondDriver: string;
    none: string;
    noneFem: string;
    notes: string;
    conflictsTitle: string;
    conflictTrip: string;
    conflictAgain: string;
    create: string;
    saving: string;
    saveAllocation: string;
  };
  tripDetail: {
    back: string;
    tripTitle: string;
    attachWarning: string;
    statusHeading: string;
    allocation: string;
    tractor: string;
    trailer: string;
    driver: string;
    secondDriver: string;
    inactive: string;
    route: string;
    notes: string;
    ordersHeading: string;
    noneAttached: string;
    detach: string;
    chooseOrder: string;
    attach: string;
    attaching: string;
    noAttachable: string;
    finalState: string;
    cancelTrip: string;
    markAs: string;
    cancelConfirm: string;
  };
  customerForm: {
    back: string;
    newTitle: string;
    companyName: string;
    cui: string;
    address: string;
    city: string;
    country: string;
    paymentTermDays: string;
    contactName: string;
    phone: string;
    email: string;
    notes: string;
    duplicateAgain: string;
    saving: string;
    saveNew: string;
    saveChanges: string;
    activeBadge: string;
    inactiveBadge: string;
    deactivate: string;
    reactivate: string;
    ordersHeading: string;
    noOrders: string;
    colNumber: string;
    colRef: string;
    colPrice: string;
    colStatus: string;
  };
  vehicleForm: {
    back: string;
    newTitle: string;
    regNumber: string;
    type: string;
    make: string;
    model: string;
    manufactureYear: string;
    vin: string;
    notes: string;
    saving: string;
    saveNew: string;
    saveChanges: string;
    inactive: string;
    deactivate: string;
    reactivate: string;
  };
  driverForm: {
    back: string;
    newTitle: string;
    lastName: string;
    firstName: string;
    phone: string;
    email: string;
    hiredAt: string;
    personalId: string;
    notes: string;
    saving: string;
    saveNew: string;
    saveChanges: string;
    inactive: string;
    deactivate: string;
    reactivate: string;
  };
  docs: {
    heading: string;
    none: string;
    colType: string;
    colNumber: string;
    colExpires: string;
    colStatus: string;
    colActions: string;
    renew: string;
    delete: string;
    deleteConfirm: string;
    newExpiryAria: string;
    addHeading: string;
    docType: string;
    numberSeries: string;
    issuedAt: string;
    expiresAt: string;
    add: string;
    saving: string;
  };
  team: {
    title: string;
    description: string;
    colName: string;
    colEmail: string;
    colRole: string;
    colStatus: string;
    roleAdmin: string;
    roleUser: string;
    inviteHeading: string;
    emailPlaceholder: string;
    invite: string;
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
      statusFinal: "Comanda este în stare finală — nu mai poate fi schimbată.",
      cancelOrder: "Anulează comanda",
      markAs: "Marchează:",
      cancelConfirm: "Sigur anulezi comanda? Anularea este definitivă și nu poate fi revenită.",
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
    crud: {
      search: "Caută",
      active: "Activ",
      inactive: "Inactiv",
      status: "Status",
      documents: "Documente",
      days: "zile",
    },
    customers: {
      title: "Clienți",
      description: "Firmele care îți trimit comenzi de transport.",
      newLabel: "Client nou",
      searchPlaceholder: "Caută după nume sau CUI",
      showInactive: "Arată și clienții inactivi",
      hideInactive: "Ascunde clienții inactivi",
      notFound: "Niciun client. Adaugă primul client ca să poți crea comenzi.",
      colName: "Nume",
      colCui: "CUI",
      colCity: "Oraș",
      colPaymentTerm: "Termen plată",
    },
    fleet: {
      title: "Flotă",
      description: "Vehiculele firmei și starea documentelor lor.",
      newLabel: "Vehicul nou",
      searchPlaceholder: "Caută după număr",
      showInactive: "Arată și vehiculele inactive",
      hideInactive: "Ascunde vehiculele inactive",
      notFound: "Niciun vehicul. Adaugă primul vehicul ca să poți urmări documentele lui.",
      colNumber: "Număr",
      colType: "Tip",
      colMakeModel: "Marcă / model",
    },
    drivers: {
      title: "Șoferi",
      description: "Șoferii firmei și starea documentelor lor.",
      newLabel: "Șofer nou",
      searchPlaceholder: "Caută după nume",
      showInactive: "Arată și șoferii inactivi",
      hideInactive: "Ascunde șoferii inactivi",
      notFound: "Niciun șofer. Adaugă primul șofer ca să poți urmări documentele lui.",
      colName: "Nume",
      colPhone: "Telefon",
    },
    orderForm: {
      back: "← Înapoi la comenzi",
      newTitle: "Comandă nouă",
      noClients: "Nu ai niciun client activ. O comandă are nevoie de un client.",
      addFirstClient: "Adaugă primul client",
      sectionClientCargo: "Client și marfă",
      client: "Client",
      clientReference: "Referința clientului",
      cargoDescription: "Descrierea mărfii",
      weightKg: "Greutate (kg)",
      packaging: "Ambalaj",
      packagingPlaceholder: "paleți, vrac...",
      sectionStops: "Opriri",
      addLoading: "+ Încărcare",
      addUnloading: "+ Descărcare",
      delete: "Șterge",
      address: "Adresă",
      city: "Oraș",
      contactName: "Persoană de contact",
      phone: "Telefon",
      sectionMoney: "Bani",
      salePrice: "Preț de vânzare",
      currency: "Valută",
      estimatedCost: "Cost estimat (RON)",
      paymentTermDays: "Termen de plată (zile)",
      manualRate: "Curs EUR → RON (manual)",
      manualRateHint: "Cursul BNR nu este disponibil momentan. Introdu manual cursul EUR → RON.",
      bnrRate: "Curs BNR",
      bnrRateFrom: "din",
      ronEquivalent: "Echivalent în RON",
      save: "Salvează comanda",
      saving: "Se salvează...",
      saveChanges: "Salvează modificările",
      rateFrozenHint: "Echivalentul în RON se recalculează cu cursul înghețat la crearea comenzii.",
      notes: "Observații",
    },
    tripForm: {
      back: "← Înapoi la dispecerat",
      newTitle: "Cursă nouă",
      planningOrder: "Se planifică comanda {n}.",
      alreadyPlanned: "Comanda {n} este deja planificată pe altă cursă.",
      cannotPlanPrefix: "Comanda {n} nu poate fi planificată cât este „",
      cannotPlanSuffix: "” — poți crea cursa, dar va trebui să o atașezi manual.",
      start: "Început",
      end: "Sfârșit",
      tractor: "Cap tractor",
      trailer: "Semiremorcă",
      primaryDriver: "Șofer principal",
      secondDriver: "Al doilea șofer",
      none: "— niciunul —",
      noneFem: "— niciuna —",
      notes: "Observații",
      conflictsTitle: "Resurse deja ocupate în acest interval:",
      conflictTrip: "cursa",
      conflictAgain: "Apasă din nou pe buton dacă vrei să continui oricum.",
      create: "Creează cursa",
      saving: "Se salvează...",
      saveAllocation: "Salvează alocarea",
    },
    tripDetail: {
      back: "← Înapoi la dispecerat",
      tripTitle: "Cursa",
      attachWarning:
        "Cursa a fost creată, dar comanda selectată nu a putut fi atașată automat — probabil a fost planificată între timp pe altă cursă. Atașeaz-o manual mai jos, dacă mai este disponibilă.",
      statusHeading: "Stare",
      allocation: "Alocare",
      tractor: "Cap tractor",
      trailer: "Semiremorcă",
      driver: "Șofer",
      secondDriver: "Al doilea șofer",
      inactive: "inactiv",
      route: "Traseu",
      notes: "Observații",
      ordersHeading: "Comenzi pe această cursă",
      noneAttached: "Nicio comandă atașată.",
      detach: "Desprinde",
      chooseOrder: "— alege o comandă —",
      attach: "Atașează",
      attaching: "Se atașează...",
      noAttachable: "Nicio comandă neplanificată disponibilă pentru atașare.",
      finalState: "Cursa este în stare finală — nu mai poate fi schimbată.",
      cancelTrip: "Anulează cursa",
      markAs: "Marchează:",
      cancelConfirm: "Anulezi cursa? Comenzile ei revin la neplanificate.",
    },
    customerForm: {
      back: "← Înapoi la clienți",
      newTitle: "Client nou",
      companyName: "Nume firmă",
      cui: "CUI",
      address: "Adresă",
      city: "Oraș",
      country: "Țară",
      paymentTermDays: "Termen de plată (zile)",
      contactName: "Persoană de contact",
      phone: "Telefon",
      email: "Email",
      notes: "Observații",
      duplicateAgain: "Apasă din nou pe buton pentru a-l adăuga oricum.",
      saving: "Se salvează...",
      saveNew: "Salvează clientul",
      saveChanges: "Salvează modificările",
      activeBadge: "Activ",
      inactiveBadge: "Inactiv",
      deactivate: "Dezactivează",
      reactivate: "Reactivează",
      ordersHeading: "Comenzile acestui client",
      noOrders: "Nicio comandă încă.",
      colNumber: "Număr",
      colRef: "Referință",
      colPrice: "Preț",
      colStatus: "Stare",
    },
    vehicleForm: {
      back: "← Înapoi la flotă",
      newTitle: "Vehicul nou",
      regNumber: "Număr de înmatriculare",
      type: "Tip",
      make: "Marcă",
      model: "Model",
      manufactureYear: "An fabricație",
      vin: "Serie șasiu",
      notes: "Observații",
      saving: "Se salvează...",
      saveNew: "Salvează vehiculul",
      saveChanges: "Salvează modificările",
      inactive: "Inactiv",
      deactivate: "Dezactivează",
      reactivate: "Reactivează",
    },
    driverForm: {
      back: "← Înapoi la șoferi",
      newTitle: "Șofer nou",
      lastName: "Nume",
      firstName: "Prenume",
      phone: "Telefon",
      email: "Email",
      hiredAt: "Data angajării",
      personalId: "CNP (opțional)",
      notes: "Observații",
      saving: "Se salvează...",
      saveNew: "Salvează șoferul",
      saveChanges: "Salvează modificările",
      inactive: "Inactiv",
      deactivate: "Dezactivează",
      reactivate: "Reactivează",
    },
    docs: {
      heading: "Documente",
      none: "Niciun document înregistrat.",
      colType: "Tip",
      colNumber: "Număr",
      colExpires: "Expiră",
      colStatus: "Stare",
      colActions: "Acțiuni",
      renew: "Reînnoiește",
      delete: "Șterge",
      deleteConfirm: "Ștergi acest document?",
      newExpiryAria: "Noua dată de expirare",
      addHeading: "Adaugă un document",
      docType: "Tip document",
      numberSeries: "Număr / serie",
      issuedAt: "Data emiterii",
      expiresAt: "Data expirării",
      add: "Adaugă documentul",
      saving: "Se salvează...",
    },
    team: {
      title: "Echipă",
      description: "Utilizatorii care au acces la contul firmei tale.",
      colName: "Nume",
      colEmail: "Email",
      colRole: "Rol",
      colStatus: "Status",
      roleAdmin: "Admin firmă",
      roleUser: "Utilizator",
      inviteHeading: "Invită un coleg",
      emailPlaceholder: "Email coleg",
      invite: "Invită",
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
      statusFinal: "The order is in a final state — it can no longer be changed.",
      cancelOrder: "Cancel order",
      markAs: "Mark as:",
      cancelConfirm: "Cancel the order for sure? Cancellation is final and cannot be undone.",
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
    crud: {
      search: "Search",
      active: "Active",
      inactive: "Inactive",
      status: "Status",
      documents: "Documents",
      days: "days",
    },
    customers: {
      title: "Customers",
      description: "The companies that send you transport loads.",
      newLabel: "New customer",
      searchPlaceholder: "Search by name or reg. number",
      showInactive: "Show inactive customers too",
      hideInactive: "Hide inactive customers",
      notFound: "No customers. Add your first one so you can create loads.",
      colName: "Name",
      colCui: "Reg. no.",
      colCity: "City",
      colPaymentTerm: "Payment term",
    },
    fleet: {
      title: "Fleet",
      description: "The company's vehicles and the state of their documents.",
      newLabel: "New vehicle",
      searchPlaceholder: "Search by number",
      showInactive: "Show inactive vehicles too",
      hideInactive: "Hide inactive vehicles",
      notFound: "No vehicles. Add your first one to track its documents.",
      colNumber: "Number",
      colType: "Type",
      colMakeModel: "Make / model",
    },
    drivers: {
      title: "Drivers",
      description: "The company's drivers and the state of their documents.",
      newLabel: "New driver",
      searchPlaceholder: "Search by name",
      showInactive: "Show inactive drivers too",
      hideInactive: "Hide inactive drivers",
      notFound: "No drivers. Add your first one to track their documents.",
      colName: "Name",
      colPhone: "Phone",
    },
    orderForm: {
      back: "← Back to loads",
      newTitle: "New load",
      noClients: "You have no active customers. A load needs a customer.",
      addFirstClient: "Add your first customer",
      sectionClientCargo: "Customer and cargo",
      client: "Customer",
      clientReference: "Customer reference",
      cargoDescription: "Cargo description",
      weightKg: "Weight (kg)",
      packaging: "Packaging",
      packagingPlaceholder: "pallets, bulk...",
      sectionStops: "Stops",
      addLoading: "+ Loading",
      addUnloading: "+ Unloading",
      delete: "Remove",
      address: "Address",
      city: "City",
      contactName: "Contact person",
      phone: "Phone",
      sectionMoney: "Money",
      salePrice: "Selling price",
      currency: "Currency",
      estimatedCost: "Estimated cost (RON)",
      paymentTermDays: "Payment term (days)",
      manualRate: "EUR → RON rate (manual)",
      manualRateHint: "The BNR rate is not available right now. Enter the EUR → RON rate manually.",
      bnrRate: "BNR rate",
      bnrRateFrom: "from",
      ronEquivalent: "RON equivalent",
      save: "Save load",
      saving: "Saving...",
      saveChanges: "Save changes",
      rateFrozenHint: "The RON equivalent is recomputed with the rate frozen when the load was created.",
      notes: "Notes",
    },
    tripForm: {
      back: "← Back to dispatch",
      newTitle: "New trip",
      planningOrder: "Planning load {n}.",
      alreadyPlanned: "Load {n} is already planned on another trip.",
      cannotPlanPrefix: "Load {n} cannot be planned while it is “",
      cannotPlanSuffix: "” — you can create the trip, but you'll have to attach it manually.",
      start: "Start",
      end: "End",
      tractor: "Tractor unit",
      trailer: "Semi-trailer",
      primaryDriver: "Primary driver",
      secondDriver: "Second driver",
      none: "— none —",
      noneFem: "— none —",
      notes: "Notes",
      conflictsTitle: "Resources already busy in this interval:",
      conflictTrip: "trip",
      conflictAgain: "Press the button again if you want to continue anyway.",
      create: "Create trip",
      saving: "Saving...",
      saveAllocation: "Save allocation",
    },
    tripDetail: {
      back: "← Back to dispatch",
      tripTitle: "Trip",
      attachWarning:
        "The trip was created, but the selected load couldn't be attached automatically — it was probably planned onto another trip in the meantime. Attach it manually below, if it's still available.",
      statusHeading: "Status",
      allocation: "Allocation",
      tractor: "Tractor unit",
      trailer: "Semi-trailer",
      driver: "Driver",
      secondDriver: "Second driver",
      inactive: "inactive",
      route: "Route",
      notes: "Notes",
      ordersHeading: "Loads on this trip",
      noneAttached: "No loads attached.",
      detach: "Detach",
      chooseOrder: "— choose a load —",
      attach: "Attach",
      attaching: "Attaching...",
      noAttachable: "No unassigned loads available to attach.",
      finalState: "The trip is in a final state — it can no longer be changed.",
      cancelTrip: "Cancel trip",
      markAs: "Mark as:",
      cancelConfirm: "Cancel the trip? Its loads go back to unassigned.",
    },
    customerForm: {
      back: "← Back to customers",
      newTitle: "New customer",
      companyName: "Company name",
      cui: "Reg. no.",
      address: "Address",
      city: "City",
      country: "Country",
      paymentTermDays: "Payment term (days)",
      contactName: "Contact person",
      phone: "Phone",
      email: "Email",
      notes: "Notes",
      duplicateAgain: "Press the button again to add it anyway.",
      saving: "Saving...",
      saveNew: "Save customer",
      saveChanges: "Save changes",
      activeBadge: "Active",
      inactiveBadge: "Inactive",
      deactivate: "Deactivate",
      reactivate: "Reactivate",
      ordersHeading: "This customer's loads",
      noOrders: "No loads yet.",
      colNumber: "Number",
      colRef: "Reference",
      colPrice: "Price",
      colStatus: "Status",
    },
    vehicleForm: {
      back: "← Back to fleet",
      newTitle: "New vehicle",
      regNumber: "Registration number",
      type: "Type",
      make: "Make",
      model: "Model",
      manufactureYear: "Year",
      vin: "VIN",
      notes: "Notes",
      saving: "Saving...",
      saveNew: "Save vehicle",
      saveChanges: "Save changes",
      inactive: "Inactive",
      deactivate: "Deactivate",
      reactivate: "Reactivate",
    },
    driverForm: {
      back: "← Back to drivers",
      newTitle: "New driver",
      lastName: "Last name",
      firstName: "First name",
      phone: "Phone",
      email: "Email",
      hiredAt: "Hire date",
      personalId: "National ID (optional)",
      notes: "Notes",
      saving: "Saving...",
      saveNew: "Save driver",
      saveChanges: "Save changes",
      inactive: "Inactive",
      deactivate: "Deactivate",
      reactivate: "Reactivate",
    },
    docs: {
      heading: "Documents",
      none: "No documents recorded.",
      colType: "Type",
      colNumber: "Number",
      colExpires: "Expires",
      colStatus: "Status",
      colActions: "Actions",
      renew: "Renew",
      delete: "Delete",
      deleteConfirm: "Delete this document?",
      newExpiryAria: "New expiry date",
      addHeading: "Add a document",
      docType: "Document type",
      numberSeries: "Number / series",
      issuedAt: "Issue date",
      expiresAt: "Expiry date",
      add: "Add document",
      saving: "Saving...",
    },
    team: {
      title: "Team",
      description: "The users who have access to your company's account.",
      colName: "Name",
      colEmail: "Email",
      colRole: "Role",
      colStatus: "Status",
      roleAdmin: "Company admin",
      roleUser: "User",
      inviteHeading: "Invite a colleague",
      emailPlaceholder: "Colleague email",
      invite: "Invite",
    },
  },
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "ro" || value === "en";
}

export function dictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
