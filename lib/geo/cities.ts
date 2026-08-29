/**
 * Tiny offline gazetteer: city name -> approximate [lat, lng].
 *
 * We have city names on stops, not GPS coordinates, so to draw anything on a
 * map we resolve the name locally (no external geocoding API, no key, no
 * per-request cost). Coverage is Romania in full plus the major EU freight
 * hubs; an unknown city simply isn't placed on the map. Coordinates are
 * city-centre approximations — good enough for a schematic, estimated view,
 * never presented as a real GPS fix.
 *
 * This module is pure (no Prisma, no next/headers), so it is safe to import
 * from server components and client code alike.
 */

export type LatLng = [number, number];

// Keys are already normalized (see `normalizeCity`). Alternate spellings and
// EN/local names point at the same coordinate.
const CITIES: Record<string, LatLng> = {
  // --- Romania ---
  bucuresti: [44.4268, 26.1025],
  bucharest: [44.4268, 26.1025],
  "cluj-napoca": [46.7712, 23.6236],
  cluj: [46.7712, 23.6236],
  timisoara: [45.7489, 21.2087],
  iasi: [47.1585, 27.6014],
  constanta: [44.1598, 28.6348],
  brasov: [45.6579, 25.6012],
  craiova: [44.3302, 23.7949],
  galati: [45.4353, 28.008],
  ploiesti: [44.9469, 26.0215],
  oradea: [47.0465, 21.9189],
  braila: [45.2692, 27.9575],
  arad: [46.1866, 21.3123],
  pitesti: [44.8565, 24.8692],
  sibiu: [45.7983, 24.1256],
  bacau: [46.567, 26.9146],
  "targu mures": [46.5425, 24.5579],
  "targu-mures": [46.5425, 24.5579],
  "baia mare": [47.6573, 23.5681],
  buzau: [45.15, 26.8203],
  botosani: [47.7486, 26.6694],
  "satu mare": [47.7921, 22.8859],
  "ramnicu valcea": [45.0997, 24.3693],
  suceava: [47.6514, 26.2556],
  "piatra neamt": [46.9275, 26.3708],
  "drobeta-turnu severin": [44.6369, 22.6597],
  focsani: [45.696, 27.1863],
  targoviste: [44.9247, 25.4567],
  "alba iulia": [46.0733, 23.5805],
  deva: [45.8779, 22.9142],
  zalau: [47.1911, 23.057],
  vaslui: [46.6407, 27.7276],
  slatina: [44.43, 24.3707],
  giurgiu: [43.9037, 25.9699],
  resita: [45.3009, 21.8891],
  tulcea: [45.1667, 28.8],
  calarasi: [44.2058, 27.3306],
  bistrita: [47.1333, 24.5],
  slobozia: [44.5647, 27.3661],
  alexandria: [43.9709, 25.3269],
  "sfantu gheorghe": [45.8667, 25.7833],
  "miercurea ciuc": [46.36, 25.8],
  petrosani: [45.4167, 23.3667],
  medias: [46.1667, 24.35],
  onesti: [46.25, 26.7667],
  turda: [46.5667, 23.7833],

  // --- Germany ---
  hamburg: [53.5511, 9.9937],
  munchen: [48.1351, 11.582],
  munich: [48.1351, 11.582],
  frankfurt: [50.1109, 8.6821],
  berlin: [52.52, 13.405],
  koln: [50.9375, 6.9603],
  cologne: [50.9375, 6.9603],
  stuttgart: [48.7758, 9.1829],
  dusseldorf: [51.2277, 6.7735],
  nurnberg: [49.4521, 11.0767],
  nuremberg: [49.4521, 11.0767],
  leipzig: [51.3397, 12.3731],
  dortmund: [51.5136, 7.4653],
  bremen: [53.0793, 8.8017],
  hannover: [52.3759, 9.732],
  duisburg: [51.4344, 6.7623],

  // --- Italy ---
  milano: [45.4642, 9.19],
  milan: [45.4642, 9.19],
  roma: [41.9028, 12.4964],
  rome: [41.9028, 12.4964],
  torino: [45.0703, 7.6869],
  turin: [45.0703, 7.6869],
  verona: [45.4384, 10.9916],
  bologna: [44.4949, 11.3426],
  napoli: [40.8518, 14.2681],
  naples: [40.8518, 14.2681],
  padova: [45.4064, 11.8768],
  venezia: [45.4408, 12.3155],
  venice: [45.4408, 12.3155],
  bergamo: [45.6983, 9.6773],

  // --- France ---
  paris: [48.8566, 2.3522],
  lyon: [45.764, 4.8357],
  marseille: [43.2965, 5.3698],
  lille: [50.6292, 3.0573],
  strasbourg: [48.5734, 7.7521],
  bordeaux: [44.8378, -0.5792],

  // --- Spain ---
  madrid: [40.4168, -3.7038],
  barcelona: [41.3851, 2.1734],
  valencia: [39.4699, -0.3763],
  zaragoza: [41.6488, -0.8891],

  // --- Netherlands ---
  amsterdam: [52.3676, 4.9041],
  rotterdam: [51.9244, 4.4777],
  eindhoven: [51.4416, 5.4697],
  utrecht: [52.0907, 5.1214],
  venlo: [51.3704, 6.1724],

  // --- Belgium ---
  bruxelles: [50.8503, 4.3517],
  brussels: [50.8503, 4.3517],
  antwerpen: [51.2194, 4.4025],
  antwerp: [51.2194, 4.4025],
  liege: [50.6326, 5.5797],

  // --- Austria ---
  wien: [48.2082, 16.3738],
  vienna: [48.2082, 16.3738],
  graz: [47.0707, 15.4395],
  linz: [48.3069, 14.2858],
  salzburg: [47.8095, 13.055],

  // --- Hungary ---
  budapest: [47.4979, 19.0402],
  debrecen: [47.5316, 21.6273],
  szeged: [46.253, 20.1414],
  gyor: [47.6875, 17.6504],

  // --- Poland ---
  warszawa: [52.2297, 21.0122],
  warsaw: [52.2297, 21.0122],
  krakow: [50.0647, 19.945],
  wroclaw: [51.1079, 17.0385],
  poznan: [52.4064, 16.9252],
  katowice: [50.2649, 19.0238],
  lodz: [51.7592, 19.456],

  // --- Czechia / Slovakia ---
  praha: [50.0755, 14.4378],
  prague: [50.0755, 14.4378],
  brno: [49.1951, 16.6068],
  ostrava: [49.8209, 18.2625],
  bratislava: [48.1486, 17.1077],
  kosice: [48.7164, 21.2611],

  // --- Bulgaria ---
  sofia: [42.6977, 23.3219],
  plovdiv: [42.1354, 24.7453],
  ruse: [43.8356, 25.9657],
  varna: [43.2141, 27.9147],
  burgas: [42.5048, 27.4626],

  // --- Rest of Europe (major hubs) ---
  london: [51.5074, -0.1278],
  manchester: [53.4808, -2.2426],
  birmingham: [52.4862, -1.8904],
  athens: [37.9838, 23.7275],
  thessaloniki: [40.6401, 22.9444],
  zurich: [47.3769, 8.5417],
  basel: [47.5596, 7.5886],
  geneva: [46.2044, 6.1432],
  ljubljana: [46.0569, 14.5058],
  zagreb: [45.815, 15.9819],
  beograd: [44.7866, 20.4489],
  belgrade: [44.7866, 20.4489],
  "novi sad": [45.2671, 19.8335],
  copenhagen: [55.6761, 12.5683],
  lisboa: [38.7223, -9.1393],
  lisbon: [38.7223, -9.1393],
};

/** Lowercase, strip Romanian/Latin diacritics, collapse whitespace. */
export function normalizeCity(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/\s+/g, " ");
}

/** Resolve a city name to coordinates, or null if we can't place it. */
export function geocodeCity(city: string | null | undefined): LatLng | null {
  if (!city) return null;
  const key = normalizeCity(city);
  if (CITIES[key]) return CITIES[key];
  // Fall back to the part before a comma/parenthesis, e.g. "Cluj (RO)".
  const head = normalizeCity(city.split(/[,(]/)[0] ?? "");
  return CITIES[head] ?? null;
}

/** Great-circle distance in km between two points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rough ROAD distance between two city names, or null if either can't be
 * geocoded. Straight-line × 1.3 is a crude detour factor — presented with a "~".
 */
export function approxRoadKm(cityA: string | null, cityB: string | null): number | null {
  const a = geocodeCity(cityA);
  const b = geocodeCity(cityB);
  if (!a || !b) return null;
  return Math.round((haversineKm(a, b) * 1.3) / 5) * 5;
}

// --- Turning trips into map markers -----------------------------------------

export type FleetStatus = "in_transit" | "assigned" | "idle";

export type FleetTruck = {
  id: string;
  label: string;
  driver: string;
  lat: number;
  lng: number;
  status: FleetStatus;
  route?: LatLng[];
  detail?: string;
};

/** Minimal shape we need from a tracked trip (a subset of `TrackedTrip`). */
export type PlaceableTrip = {
  id: string;
  tripNumber: string;
  driver: string | null;
  originCity: string | null;
  destinationCity: string | null;
  progressPct: number;
  status: "IN_PROGRESS" | "PLANNED" | string;
};

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/**
 * Estimate each active trip's map position by interpolating along the straight
 * origin -> destination line by its (already estimated) progress — the same
 * estimate the progress bars show, just on a map. Trips whose endpoints we
 * can't geocode are dropped rather than faked.
 */
export function buildFleetPositions(trips: PlaceableTrip[]): FleetTruck[] {
  const out: FleetTruck[] = [];
  for (const trip of trips) {
    const from = geocodeCity(trip.originCity);
    const to = geocodeCity(trip.destinationCity);
    if (!from || !to) continue;

    const f = Math.min(1, Math.max(0, trip.progressPct / 100));
    const lat = lerp(from[0], to[0], f);
    const lng = lerp(from[1], to[1], f);

    out.push({
      id: trip.id,
      label: trip.tripNumber,
      driver: trip.driver ?? "—",
      lat,
      lng,
      status: trip.status === "IN_PROGRESS" ? "in_transit" : "assigned",
      route: [from, to],
      detail:
        trip.originCity && trip.destinationCity
          ? `${trip.originCity} → ${trip.destinationCity}`
          : undefined,
    });
  }
  return out;
}
