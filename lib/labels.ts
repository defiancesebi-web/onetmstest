import type { Locale } from "@/lib/i18n";
import type { OwnerDocumentStatus } from "@/lib/documentStatus";
import type {
  OrderStatus,
  TripStatus,
  StopType,
  VehicleType,
  DocumentType,
  InvoiceStatus,
  EfacturaStatus,
} from "@/lib/generated/prisma/enums";

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

export const OWNER_DOC_STATUS_I18N: Record<Locale, Record<OwnerDocumentStatus, string>> = {
  ro: {
    EXPIRED: "Expirat",
    EXPIRING_SOON: "Expiră curând",
    VALID: "În regulă",
    NO_DOCUMENTS: "Fără documente",
  },
  en: {
    EXPIRED: "Expired",
    EXPIRING_SOON: "Expiring soon",
    VALID: "Valid",
    NO_DOCUMENTS: "No documents",
  },
};

export const VEHICLE_TYPE_I18N: Record<Locale, Record<VehicleType, string>> = {
  ro: {
    TRACTOR_UNIT: "Cap tractor",
    SEMI_TRAILER: "Semiremorcă",
    RIGID_TRUCK: "Autocamion",
    VAN_3_5T: "Dubă 3.5t",
  },
  en: {
    TRACTOR_UNIT: "Tractor unit",
    SEMI_TRAILER: "Semi-trailer",
    RIGID_TRUCK: "Rigid truck",
    VAN_3_5T: "Van 3.5t",
  },
};

export const DOCUMENT_TYPE_I18N: Record<Locale, Record<DocumentType, string>> = {
  ro: {
    ITP: "ITP",
    RCA: "RCA",
    CASCO: "CASCO",
    ROVINIETA: "Rovinietă",
    TAHOGRAF: "Verificare tahograf",
    COPIE_CONFORMA: "Copie conformă",
    ASIGURARE_CMR: "Asigurare CMR",
    PERMIS_CONDUCERE: "Permis de conducere",
    ATESTAT_PROFESIONAL: "Atestat profesional",
    CARD_TAHOGRAF: "Card tahograf",
    AVIZ_MEDICAL: "Aviz medical",
    AVIZ_PSIHOLOGIC: "Aviz psihologic",
  },
  en: {
    ITP: "Roadworthiness (ITP)",
    RCA: "Liability insurance (RCA)",
    CASCO: "CASCO",
    ROVINIETA: "Road tax (Rovinietă)",
    TAHOGRAF: "Tachograph check",
    COPIE_CONFORMA: "Certified copy",
    ASIGURARE_CMR: "CMR insurance",
    PERMIS_CONDUCERE: "Driving licence",
    ATESTAT_PROFESIONAL: "Professional certificate",
    CARD_TAHOGRAF: "Tachograph card",
    AVIZ_MEDICAL: "Medical certificate",
    AVIZ_PSIHOLOGIC: "Psychological certificate",
  },
};

export const INVOICE_STATUS_I18N: Record<Locale, Record<InvoiceStatus, string>> = {
  ro: { DRAFT: "Ciornă", ISSUED: "Emisă", PAID: "Plătită", CANCELLED: "Anulată" },
  en: { DRAFT: "Draft", ISSUED: "Issued", PAID: "Paid", CANCELLED: "Cancelled" },
};

export const EFACTURA_STATUS_I18N: Record<Locale, Record<EfacturaStatus, string>> = {
  ro: {
    NOT_SENT: "Netrimisă",
    PENDING: "În curs",
    SENT: "Trimisă",
    ACCEPTED: "Acceptată",
    REJECTED: "Respinsă",
  },
  en: {
    NOT_SENT: "Not sent",
    PENDING: "Pending",
    SENT: "Sent",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
  },
};

export const invoiceStatusLabel = (s: InvoiceStatus, locale: Locale) =>
  INVOICE_STATUS_I18N[locale][s];
export const efacturaStatusLabel = (s: EfacturaStatus, locale: Locale) =>
  EFACTURA_STATUS_I18N[locale][s];

export const orderStatusLabel = (s: OrderStatus, locale: Locale) => ORDER_STATUS_I18N[locale][s];
export const tripStatusLabel = (s: TripStatus, locale: Locale) => TRIP_STATUS_I18N[locale][s];
export const stopTypeLabel = (s: StopType, locale: Locale) => STOP_TYPE_I18N[locale][s];
export const ownerDocStatusLabel = (s: OwnerDocumentStatus, locale: Locale) =>
  OWNER_DOC_STATUS_I18N[locale][s];
export const vehicleTypeLabel = (s: VehicleType, locale: Locale) => VEHICLE_TYPE_I18N[locale][s];
export const documentTypeLabel = (s: DocumentType, locale: Locale) => DOCUMENT_TYPE_I18N[locale][s];
