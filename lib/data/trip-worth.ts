import type { SessionUser } from "@/lib/tenancy";
import { getCostAnalysis } from "@/lib/data/expenses";

/**
 * The cost basis the "Is the trip worth it?" simulator needs: the fleet's real
 * cost per km (rolling 12 months) and each tractor's own cost/km, so a
 * dispatcher can price a load in seconds. Reuses getCostAnalysis; everything is
 * a plain number so it serialises straight to the client widget.
 */

export type TripWorthTruck = { id: string; registrationNumber: string; costPerKm: number };

export type TripWorthBasis = {
  fleetCostPerKm: number | null;
  trucks: TripWorthTruck[];
};

export async function getTripWorthBasis(
  session: SessionUser,
  companyId: string
): Promise<TripWorthBasis> {
  const cost = await getCostAnalysis(session, companyId, "rolling12");
  return {
    fleetCostPerKm: cost.costPerKm,
    trucks: cost.tractors
      .map((t) => ({
        id: t.id,
        registrationNumber: t.registrationNumber,
        // Fully-loaded (with overhead) is the honest "does it actually pay" cost.
        costPerKm: t.fullyLoadedCostPerKm ?? t.costPerKm ?? 0,
      }))
      .filter((t) => t.costPerKm > 0),
  };
}
