"use server";

import { auth } from "@/auth";
import { getTripWorthBasis, type TripWorthBasis } from "@/lib/data/trip-worth";

export async function loadTripWorthBasisAction(): Promise<TripWorthBasis> {
  const s = await auth();
  if (!s?.user.companyId) return { fleetCostPerKm: null, trucks: [] };
  return getTripWorthBasis(
    { role: s.user.role, companyId: s.user.companyId },
    s.user.companyId
  );
}
