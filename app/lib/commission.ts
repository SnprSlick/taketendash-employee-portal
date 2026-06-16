// app/lib/commission.ts

export type Position = 'mechanic' | 'tire-tech' | 'service-tech' | 'warehouse' | 'lube' | 'retail';

export interface AddOnState {
  vendorCerts: number;        // 0–max depending on position
  entryLevelBGCerts: number;  // 0–2 (Tire Tech only)
  entryLevelASE: number;      // 0–2 (Lube only)
  msha: boolean;
  forklift: boolean;
  pastExperienceYears: number; // 0–12
  saturdayRotation: boolean;
  commitmentBonus: boolean;
  cdl: boolean;               // Service Tech only
  addedCallsPerWeek: number;  // Service Tech only
}

export interface CommissionResult {
  basePay: number;              // hourly
  addOnsPerHour: number;
  effectiveHourly: number;
  weeklyBasePay: number;        // effectiveHourly * 40
  commissionRate: number;       // percentage as decimal (0 if below threshold)
  weeklyCommission: number;
  weeklyTotal: number;
  annualized: number;
}

const BASE_PAY: Record<string, number> = {
  'mechanic-tools': 22,
  'mechanic-no-tools': 18,
  'tire-tech': 18,
  'service-tech': 18,
  'warehouse': 18,
  'lube': 14,
  'retail': 18,
};

// Commission tiers: [minBilled, rate]
const SERVICE_TECH_TIERS: [number, number][] = [
  [7000, 0.04],
  [10000, 0.05],
  [12500, 0.06],
  [15000, 0.07],
  [20000, 0.085],
];

const NON_FLAG_TIERS: [number, number][] = [
  [14000, 0.02],
  [16000, 0.03],
  [18000, 0.04],
  [22000, 0.05],
  [24000, 0.06],
  [28000, 0.07],
];

export function getCommissionRate(position: Position, weeklyBilled: number): number {
  if (position === 'service-tech') {
    for (let i = SERVICE_TECH_TIERS.length - 1; i >= 0; i--) {
      if (weeklyBilled >= SERVICE_TECH_TIERS[i][0]) return SERVICE_TECH_TIERS[i][1];
    }
    return 0;
  }
  if (position === 'mechanic' || position === 'tire-tech') {
    for (let i = NON_FLAG_TIERS.length - 1; i >= 0; i--) {
      if (weeklyBilled >= NON_FLAG_TIERS[i][0]) return NON_FLAG_TIERS[i][1];
    }
    return 0;
  }
  return 0;
}

export function hasCommission(position: Position): boolean {
  return position === 'mechanic' || position === 'tire-tech' || position === 'service-tech';
}

export function calcAddOnsPerHour(position: Position, addOns: AddOnState): number {
  let total = 0;

  // Vendor certs (position-specific max)
  if (position === 'mechanic') total += Math.min(addOns.vendorCerts, 5) * 0.25;
  if (position === 'tire-tech') total += Math.min(addOns.vendorCerts, 2) * 0.25;
  if (position === 'service-tech') total += Math.min(addOns.vendorCerts, 5) * 0.25;

  // Entry level BG (Tire Tech only)
  if (position === 'tire-tech') {
    total += Math.min(addOns.entryLevelBGCerts, 2) * 0.25;
  }

  // Entry level ASE (Lube only)
  if (position === 'lube') {
    total += Math.min(addOns.entryLevelASE, 2) * 0.25;
  }

  // Flat checkboxes
  if (addOns.msha) total += 0.50;
  if (addOns.forklift && (position === 'mechanic' || position === 'service-tech' || position === 'warehouse' || position === 'lube' || position === 'retail')) total += 0.25;
  if (addOns.saturdayRotation && (position === 'mechanic' || position === 'tire-tech' || position === 'service-tech' || position === 'lube' || position === 'retail')) total += 0.15;
  if (addOns.commitmentBonus) total += 0.25;
  if (addOns.cdl && position === 'service-tech') total += 1.75;

  // Past experience: $0.50 per 3 years, max $2.00
  total += Math.min(Math.floor(addOns.pastExperienceYears / 3) * 0.50, 2.00);

  return total;
}

export function calcAddedProgramWeekly(addOns: AddOnState): number {
  if (addOns.addedCallsPerWeek > 0) {
    return addOns.addedCallsPerWeek * 30;
  }
  return 0;
}

export function calcPay(
  position: Position,
  mechanicWithTools: boolean,
  addOns: AddOnState,
  weeklyBilled: number
): CommissionResult {
  const baseKey = position === 'mechanic'
    ? (mechanicWithTools ? 'mechanic-tools' : 'mechanic-no-tools')
    : position;
  const basePay = BASE_PAY[baseKey] || 0;
  const addOnsPerHour = calcAddOnsPerHour(position, addOns);
  const effectiveHourly = basePay + addOnsPerHour;
  const weeklyBasePay = effectiveHourly * 40;

  let commissionRate = 0;
  let weeklyCommission = 0;
  if (hasCommission(position)) {
    commissionRate = getCommissionRate(position, weeklyBilled);
    weeklyCommission = weeklyBilled * commissionRate;
  }

  const addedWeekly = calcAddedProgramWeekly(addOns);

  const weeklyTotal = weeklyBasePay + weeklyCommission + addedWeekly;
  const annualized = weeklyTotal * 52;

  return {
    basePay,
    addOnsPerHour,
    effectiveHourly,
    weeklyBasePay,
    commissionRate,
    weeklyCommission,
    weeklyTotal,
    annualized,
  };
}
