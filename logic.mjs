import { AIRPORTS, greatCircleMiles } from './airports.mjs';

// LOT-operated flights only. Source tables checked 13 November 2026.
export const FARES = {
  C: ['Business', 1.50, 750, 2000, 2.0, 1000],
  D: ['Business', 1.50, 750, 2000, 2.0, 1000],
  F: ['Business', 1.25, 750, 1250, 1.5, 750],
  Z: ['Business', 1.25, 750, 1250, 1.5, 750],
  P: ['Premium Economy', 1.25, 500, 1350, 1.6, 750],
  A: ['Premium Economy', 1.25, 500, 1250, 1.5, 750],
  R: ['Premium Economy', 1.0, 500, 750, 1.0, 500],
  B: ['Economy', 1.0, 500, 1250, 1.5, 750],
  Y: ['Economy', 1.0, 500, 1250, 1.5, 750],
  M: ['Economy', 1.0, 500, 1250, 1.0, 500],
  E: ['Economy', 1.0, 500, 750, 1.0, 500],
  H: ['Economy', 1.0, 500, 750, 1.0, 500],
  K: ['Economy', 1.0, 500, 750, 1.0, 500],
  Q: ['Economy', .75, 500, 750, 1.0, 500],
  T: ['Economy', .75, 500, 500, .5, 250],
  G: ['Economy', .75, 500, 500, .5, 250],
  S: ['Economy', .75, 500, 500, .5, 250],
  V: ['Economy', .5, 250, 500, .5, 250],
  W: ['Economy', .5, 250, 125, .25, 250],
  L: ['Economy', .25, 125, 125, .25, 250],
  U: ['Economy', .25, 125, 125, .25, 250],
  O: ['Economy', .25, 125, 125, .25, 250],
  I: null, J: null, N: null, X: null
};

const EUROPE_DOMESTIC = {B:1000, Y:1000, E:500, H:500, K:500, M:500, G:250, Q:250, S:250, T:250, V:250, L:125, O:125, U:125, W:125};
export const formatter = new Intl.NumberFormat('en-GB');
export const fmt = n => (n === null || !Number.isFinite(n)) ? '—' : formatter.format(n);

/** Category of a single flight segment for LOT/M&M; user may override classification. */
export function routeDetails(origin, destination, distanceOverride = null, categoryOverride = 'auto') {
  const from = AIRPORTS[String(origin).toUpperCase()];
  const to = AIRPORTS[String(destination).toUpperCase()];
  const override = Number(distanceOverride);
  const distance = distanceOverride !== null && distanceOverride !== '' && Number.isFinite(override) && override > 0
    ? Math.round(override) : from && to ? greatCircleMiles(from, to) : null;
  let category;
  if (categoryOverride && categoryOverride !== 'auto') category = categoryOverride;
  else if (from && to && from.zone === 'EU' && to.zone === 'EU')
    category = from.country === to.country ? 'domestic' : 'europe';
  else if (from && to && from.zone === to.zone) category = 'same-continent';
  else if (from && to) category = 'intercontinental';
  else category = null;
  return { from, to, distance, category, hasAirportData: Boolean(from && to), manualDistance: distanceOverride !== null && distanceOverride !== '' };
}

/**
 * Expected credits for ONE LOT-operated flight leg.
 * mmFareAmount is eligible fare in EUR per leg on LH Group issued tickets.
 */
export function calculateSegment({origin='WAW', destination='OTP', fareClass='E', distanceOverride=null, categoryOverride='auto', mmMethod='class', mmFareAmount=null, mmStatus=false}) {
  const code = String(fareClass || '').toUpperCase();
  const fare = Object.hasOwn(FARES, code) ? FARES[code] : undefined;
  const route = routeDetails(origin, destination, distanceOverride, categoryOverride);
  const notEligible = fare === null;
  const valid = fare !== undefined && route.category !== null && (notEligible || route.distance !== null);
  if (!valid) return {valid:false, reason: fare === undefined ? 'Choose a recognised LOT booking class.' : !route.category ? 'Choose the route category (airport not in the offline list).' : 'Enter the flown distance for this airport pair.', route};

  const cabin = fare ? fare[0] : 'Ineligible';
  const turkishMiles = notEligible ? 0 : Math.max(fare[2], Math.round(route.distance * fare[1]));
  const withinEurope = route.category === 'domestic' || route.category === 'europe';
  const continental = route.category !== 'intercontinental';
  let mmMiles;
  let note = '';
  if (notEligible) {
    mmMiles = 0;
  } else if (mmMethod === 'fare') {
    // Ticket must have been issued through a LH Group qualifying booking channel.
    mmMiles = mmFareAmount !== null && Number.isFinite(Number(mmFareAmount)) && Number(mmFareAmount) >= 0
      ? Math.round(Number(mmFareAmount) * (mmStatus ? 6 : 4)) : null;
    if (mmMiles === null) note = 'Enter eligible airfare in EUR to estimate Miles & More award miles.';
  } else if (withinEurope) {
    mmMiles = route.category === 'domestic' ? (EUROPE_DOMESTIC[code] ?? null) : fare[3];
    if (mmMiles === null) note = 'Miles & More does not publish a domestic-European fixed award-mile amount for this cabin/class in the LOT table.';
  } else {
    mmMiles = Math.max(fare[5], Math.round(route.distance * fare[4]));
  }

  const points = notEligible ? 0 : (continental
    ? (cabin === 'Business' ? 40 : 20)
    : (cabin === 'Business' ? 200 : cabin === 'Premium Economy' ? 80 : 60));
  const result = {
    valid: true, code, cabin, route, notEligible,
    turkish: {awardMiles:turkishMiles, statusMiles:turkishMiles},
    mm: {awardMiles:mmMiles, points, qualifyingPoints:points, honPoints:cabin === 'Business' ? points : 0}, note
  };
  return result;
}

export function calculateItinerary(options) {
  const legs = options.roundTrip ? 2 : 1;
  const mmMethod = options.mmMethod || 'class';
  const suppliedFare = options.mmFareAmount === '' || options.mmFareAmount === null || options.mmFareAmount === undefined ? null : Number(options.mmFareAmount);
  const farePerLeg = suppliedFare === null ? null : suppliedFare / legs;
  const outbound = calculateSegment({...options, mmMethod, mmFareAmount:farePerLeg});
  if (!outbound.valid) return {valid:false, reason:outbound.reason, route:outbound.route};
  const inbound = options.roundTrip ? calculateSegment({
    ...options, origin:options.destination, destination:options.origin,
    mmMethod, mmFareAmount:farePerLeg
  }) : null;
  if (inbound && !inbound.valid) return {valid:false, reason:inbound.reason, route:inbound.route};
  const results = inbound ? [outbound, inbound] : [outbound];
  const sum = (path) => results.reduce((total,r) => {
    let v = path.reduce((value,key) => value[key],r);
    return v === null || total === null ? null : total + v;
  }, 0);
  return {
    valid:true, legs:results, distance:sum(['route','distance']),
    turkish:{statusMiles:sum(['turkish','statusMiles']), awardMiles:sum(['turkish','awardMiles'])},
    mm:{awardMiles:sum(['mm','awardMiles']), points:sum(['mm','points']), qualifyingPoints:sum(['mm','qualifyingPoints']), honPoints:sum(['mm','honPoints'])}
  };
}
