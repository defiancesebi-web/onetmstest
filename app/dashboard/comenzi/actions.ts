"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createOrder,
  updateOrderStatus,
  updateOrderDetails,
  InvalidOrderError,
  OrderNumberingError,
  OrderNotFoundError,
  type CreateStopInput,
} from "@/lib/data/orders";
import { ExchangeRateUnavailableError } from "@/lib/bnr";
import { InvalidStatusTransitionError } from "@/lib/orderStatus";
import { TenantAccessError } from "@/lib/tenancy";
import type { Currency, OrderStatus } from "@/lib/generated/prisma/enums";

export type OrderFormState = {
  error: string | null;
  /** Set when BNR is unreachable, so the form can ask for a manual rate. */
  needsManualRate: boolean;
};

type StopPayload = {
  type: "LOADING" | "UNLOADING";
  locationName?: string;
  address: string;
  city: string;
  country?: string;
  scheduledDate: string;
  timeFrom?: string;
  timeTo?: string;
  contactName?: string;
  contactPhone?: string;
};

export async function createOrderAction(
  _prevState: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const rawStops = formData.get("stops") as string;
  let stops: CreateStopInput[];
  try {
    stops = (JSON.parse(rawStops) as StopPayload[]).map((stop) => ({
      type: stop.type,
      locationName: stop.locationName || null,
      address: stop.address,
      city: stop.city,
      country: stop.country || "România",
      scheduledDate: new Date(stop.scheduledDate),
      timeFrom: stop.timeFrom || null,
      timeTo: stop.timeTo || null,
      contactName: stop.contactName || null,
      contactPhone: stop.contactPhone || null,
    }));
  } catch {
    return { error: "Opririle nu au putut fi citite. Reîncarcă pagina.", needsManualRate: false };
  }

  const manualRate = (formData.get("manualExchangeRate") as string) || undefined;

  try {
    await createOrder(
      { role: session.user.role, companyId: session.user.companyId },
      {
        companyId: session.user.companyId,
        clientId: formData.get("clientId") as string,
        clientReference: formData.get("clientReference") as string,
        cargoDescription: formData.get("cargoDescription") as string,
        cargoWeightKg: (formData.get("cargoWeightKg") as string) || null,
        cargoPackaging: (formData.get("cargoPackaging") as string) || null,
        salePrice: formData.get("salePrice") as string,
        currency: formData.get("currency") as Currency,
        estimatedCostRon: (formData.get("estimatedCostRon") as string) || null,
        paymentTermDays: Number(formData.get("paymentTermDays") || 45),
        notes: (formData.get("notes") as string) || null,
        stops,
        manualExchangeRate: manualRate,
      }
    );
  } catch (error) {
    if (error instanceof ExchangeRateUnavailableError) {
      return {
        error: `${error.message} Introdu manual cursul EUR → RON și trimite din nou.`,
        needsManualRate: true,
      };
    }
    if (error instanceof InvalidOrderError || error instanceof OrderNumberingError) {
      return { error: error.message, needsManualRate: false };
    }
    throw error;
  }

  revalidatePath("/dashboard/comenzi");
  redirect("/dashboard/comenzi");
}

export type StatusActionState = { error: string | null };

// Called directly from a client onClick (not bound to a <form action>): the
// cancel button needs a confirm() gate before it submits anything, and every
// transition needs its error message to survive the automatic page refresh
// that follows a server action call. A per-button useActionState/form was
// tried first, but ALLOWED_TRANSITIONS[order.status] necessarily excludes
// whatever target just failed — that's what "failed" means — so the button
// carrying the freshly-set error is exactly the one that disappears (its key
// stops existing in the next button list) the instant the refreshed status
// prop arrives, and React discards its local state before ever painting it.
// Calling the action directly and keeping the error in the parent
// StatusActions component (which isn't remounted by a status-prop change)
// keeps the message on screen across that refresh.
export async function updateOrderStatusAction(
  orderId: string,
  to: OrderStatus
): Promise<StatusActionState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateOrderStatus(
      { role: session.user.role, companyId: session.user.companyId },
      orderId,
      to
    );
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      // Buttons only offer allowed transitions, so this means a stale page:
      // another dispatcher already moved the order. Refresh it and tell the
      // user why nothing happened, instead of failing silently.
      revalidatePath(`/dashboard/comenzi/${orderId}`);
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/dashboard/comenzi/${orderId}`);
  revalidatePath("/dashboard/comenzi");
  return { error: null };
}

export async function updateOrderDetailsAction(
  orderId: string,
  _prevState: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateOrderDetails(
      { role: session.user.role, companyId: session.user.companyId },
      orderId,
      {
        clientReference: formData.get("clientReference") as string,
        cargoDescription: formData.get("cargoDescription") as string,
        cargoWeightKg: (formData.get("cargoWeightKg") as string) || null,
        cargoPackaging: (formData.get("cargoPackaging") as string) || null,
        salePrice: formData.get("salePrice") as string,
        estimatedCostRon: (formData.get("estimatedCostRon") as string) || null,
        paymentTermDays: Number(formData.get("paymentTermDays") || 45),
        notes: (formData.get("notes") as string) || null,
      }
    );
  } catch (error) {
    // Cross-tenant access must be indistinguishable from non-existence — same
    // message as OrderNotFoundError — so a user of one carrier can't probe
    // another carrier's order ids and learn which ones are real.
    if (error instanceof OrderNotFoundError || error instanceof TenantAccessError) {
      return { error: "Comanda nu a fost găsită.", needsManualRate: false };
    }
    if (error instanceof Error && error.message.startsWith("[DecimalError]")) {
      return { error: "Prețul de vânzare introdus nu este valid.", needsManualRate: false };
    }
    throw error;
  }

  revalidatePath(`/dashboard/comenzi/${orderId}`);
  revalidatePath("/dashboard/comenzi");
  return { error: null, needsManualRate: false };
}
