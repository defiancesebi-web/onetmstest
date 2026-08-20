import type { Locale } from "@/lib/i18n";
import type { OrderStatus, TripStatus, StopType } from "@/lib/generated/prisma/enums";

/**
 * Bilingual labels for the domain enums shown in the UI. Separate from the RO
 * maps in lib/orderStatus.ts / lib/tripStatus.ts, which stay RO because they
 * feed server-side error messages. Display components take a `locale` and read
 * from here.
 */
export const ORDER_STATUS_I18N: Record<Locale, Record<OrderStatus, string>> = {
  ro: {
    NEW: "Nouă",
    CONFIRMED: "Confirmată",
    IN_PROGRESS: "În execuție",
    DELIVERED: "Livrată",
    DOCUMENTS_RECEIVED: "Documente primite",
    INVOICED: "Facturată",
    CANCELLED: "Anulată",
  },
  en: {
    NEW: "New",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In transit",
    DELIVERED: "Delivered",
    DOCUMENTS_RECEIVED: "Docs received",
    INVOICED: "Invoiced",
    CANCELLED: "Cancelled",
  },
};

export const TRIP_STATUS_I18N: Record<Locale, Record<TripStatus, string>> = {
  ro: { PLANNED: "Planificată", IN_PROGRESS: "În execuție", COMPLETED: "Încheiată", CANCELLED: "Anulată" },
  en: { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" },
};

export const STOP_TYPE_I18N: Record<Locale, Record<StopType, string>> = {
  ro: { LOADING: "Încărcare", UNLOADING: "Descărcare" },
  en: { LOADING: "Loading", UNLOADING: "Unloading" },
};

export const orderStatusLabel = (s: OrderStatus, locale: Locale) => ORDER_STATUS_I18N[locale][s];
export const tripStatusLabel = (s: TripStatus, locale: Locale) => TRIP_STATUS_I18N[locale][s];
export const stopTypeLabel = (s: StopType, locale: Locale) => STOP_TYPE_I18N[locale][s];
