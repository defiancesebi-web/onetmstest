"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createTrip,
  updateTripResources,
  updateTripDates,
  updateTripStatus,
  attachOrderToTrip,
  detachOrderFromTrip,
  findResourceConflicts,
  InvalidTripError,
  TripNotFoundError,
  TripNumberingError,
  type ResourceConflict,
} from "@/lib/data/trips";
import { InvalidTripStatusTransitionError } from "@/lib/tripStatus";
import { TenantAccessError } from "@/lib/tenancy";
import type { TripStatus } from "@/lib/generated/prisma/enums";

export type TripFormState = {
  error: string | null;
  /** Populated when a resource is already busy; the user may submit again to accept. */
  conflicts: ResourceConflict[];
};

function readResources(formData: FormData) {
  return {
    tractorUnitId: (formData.get("tractorUnitId") as string) || null,
    trailerId: (formData.get("trailerId") as string) || null,
    primaryDriverId: (formData.get("primaryDriverId") as string) || null,
    secondDriverId: (formData.get("secondDriverId") as string) || null,
  };
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const text = value as string;
  if (!text) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  // An unparsable date yields an Invalid Date object, which is truthy — without
  // this check it would sail past the caller's `if (!date)` guard into Prisma.
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function createTripAction(
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const sessionUser = { role: session.user.role, companyId: session.user.companyId };
  const companyId = session.user.companyId;

  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));
  if (!startsAt || !endsAt) {
    return { error: "Ambele date ale cursei sunt obligatorii.", conflicts: [] };
  }

  const resources = readResources(formData);
  const accepted = formData.get("acceptConflicts") === "true";

  if (!accepted) {
    const conflicts = await findResourceConflicts(sessionUser, companyId, {
      startsAt,
      endsAt,
      ...resources,
    });
    if (conflicts.length > 0) return { error: null, conflicts };
  }

  let tripId: string;
  try {
    const trip = await createTrip(sessionUser, {
      companyId,
      startsAt,
      endsAt,
      ...resources,
      notes: (formData.get("notes") as string) || null,
    });
    tripId = trip.id;
  } catch (error) {
    if (error instanceof InvalidTripError || error instanceof TripNumberingError) {
      return { error: error.message, conflicts: [] };
    }
    throw error;
  }

  const orderId = formData.get("orderId") as string;
  if (orderId) {
    try {
      await attachOrderToTrip(sessionUser, tripId, orderId);
    } catch (error) {
      if (error instanceof InvalidTripError) {
        // The trip exists; only the attach failed. Sending the user to it beats
        // losing the trip they just created.
        revalidatePath("/dashboard/dispecerat");
        redirect(`/dashboard/curse/${tripId}`);
      }
      throw error;
    }
  }

  revalidatePath("/dashboard/dispecerat");
  redirect(`/dashboard/curse/${tripId}`);
}

export async function updateTripResourcesAction(
  tripId: string,
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const sessionUser = { role: session.user.role, companyId: session.user.companyId };
  const resources = readResources(formData);
  const accepted = formData.get("acceptConflicts") === "true";

  const startsAt = parseDate(formData.get("startsAt"));
  const endsAt = parseDate(formData.get("endsAt"));
  if (!startsAt || !endsAt) {
    return { error: "Ambele date ale cursei sunt obligatorii.", conflicts: [] };
  }

  if (!accepted) {
    const conflicts = await findResourceConflicts(sessionUser, session.user.companyId, {
      startsAt,
      endsAt,
      ...resources,
      excludeTripId: tripId,
    });
    if (conflicts.length > 0) return { error: null, conflicts };
  }

  try {
    await updateTripResources(sessionUser, tripId, resources);
    if (formData.get("datesChanged") === "true") {
      await updateTripDates(sessionUser, tripId, startsAt, endsAt);
    }
  } catch (error) {
    if (error instanceof InvalidTripError) return { error: error.message, conflicts: [] };
    // Same message for both, so a wrong id cannot confirm another company's data.
    if (error instanceof TripNotFoundError || error instanceof TenantAccessError) {
      return { error: new TripNotFoundError().message, conflicts: [] };
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
  return { error: null, conflicts: [] };
}

export type TripStatusActionState = { error: string | null };

// Called directly from a client onClick (not bound to a <form action>), and the
// error is kept in the parent TripStatusActions component rather than in a
// per-button useActionState. Mirrors updateOrderStatusAction/StatusActions in
// app/dashboard/comenzi: ALLOWED_TRIP_TRANSITIONS[trip.status] necessarily
// excludes whatever target just failed, so a per-button state would be
// discarded by the very status-prop refresh that follows a server action —
// its key stops existing in the next button list before React ever paints the
// error. The container survives that refresh, so the message does too.
export async function updateTripStatusAction(
  tripId: string,
  to: TripStatus
): Promise<TripStatusActionState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await updateTripStatus(
      { role: session.user.role, companyId: session.user.companyId },
      tripId,
      to
    );
  } catch (error) {
    if (
      error instanceof InvalidTripStatusTransitionError ||
      error instanceof TripNotFoundError ||
      error instanceof TenantAccessError
    ) {
      // Buttons only offer allowed transitions, so this means a stale page.
      revalidatePath(`/dashboard/curse/${tripId}`);
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
  revalidatePath("/dashboard/comenzi");
  return { error: null };
}

export async function attachOrderAction(
  tripId: string,
  _prevState: TripFormState,
  formData: FormData
): Promise<TripFormState> {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  const orderId = formData.get("orderId") as string;
  if (!orderId) return { error: "Alege o comandă.", conflicts: [] };

  try {
    await attachOrderToTrip(
      { role: session.user.role, companyId: session.user.companyId },
      tripId,
      orderId
    );
  } catch (error) {
    if (error instanceof InvalidTripError) return { error: error.message, conflicts: [] };
    if (error instanceof TripNotFoundError || error instanceof TenantAccessError) {
      return { error: new TripNotFoundError().message, conflicts: [] };
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
  return { error: null, conflicts: [] };
}

export async function detachOrderAction(orderId: string, tripId: string) {
  const session = await auth();
  if (!session?.user.companyId) throw new Error("Neautentificat");

  try {
    await detachOrderFromTrip(
      { role: session.user.role, companyId: session.user.companyId },
      orderId
    );
  } catch (error) {
    if (error instanceof TripNotFoundError || error instanceof TenantAccessError) {
      revalidatePath(`/dashboard/curse/${tripId}`);
      return;
    }
    throw error;
  }

  revalidatePath(`/dashboard/curse/${tripId}`);
  revalidatePath("/dashboard/dispecerat");
}
