# Commission & Pay Calculator Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Build a manager-only commission calculator page at `/commission` that computes total pay offers (base + add-ons + commission) for prospective employees.

**Architecture:** Pure client-side page. All calculations are pure TypeScript functions in `app/lib/commission.ts`. No backend changes needed — all rates hardcoded from the compensation plan PDF.

**Tech Stack:** Next.js 14 (App Router, 'use client'), TypeScript, Tailwind CSS, lucide-react icons

**Position / Base Pay:**

| Position | Base Pay |
|---|---|
| Mechanic (with tools) | $22/hr |
| Mechanic (without tools) | $18/hr |
| Tire Tech | $18/hr |
| Service Tech | $18/hr |
| Warehouse | $18/hr |
| Lube | $14/hr |
| Retail | $18/hr |

**Commission Programs:**
- Service Tech → Service Tech Commission (labor only, 4–8.5%)
- Mechanic / Tire Tech → Non-Flag Hour Commission (labor + parts, 2–7%)
- Warehouse / Lube / Retail → no commission

**Add-On Certifications (position-specific):**

| Add-On | Value | Mechanic | Tire Tech | Service Tech | Warehouse | Lube | Retail |
|---|---|---|---|---|---|---|---|
| ASE/BG/Tire Vendor Certs (number input) | $0.25/ea, max 5 (Mechanic/Service Tech), max 2 (Tire Tech) | 0–5 | 0–2 | 0–5 | — | — | — |
| Entry Level BG (number input) | $0.25/ea, max 2 | — | 0–2 | — | — | — | — |
| Entry Level ASE (number input) | $0.25/ea, max 2 | — | — | — | — | 0–2 | — |
| MSHA (checkbox) | $0.50 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Forklift (checkbox) | $0.25 | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Past Experience (number input, years) | $0.50/3yr, max $2 | 0–12 | 0–12 | 0–12 | 0–12 | 0–12 | 0–12 |
| Saturday Rotation (checkbox) | $0.15 | ✓ | ✓ | ✓ | — | ✓ | ✓ (non-mgr only) |
| Commitment Bonus 6+ yrs (checkbox) | $0.25 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CDL/LgOTR (checkbox) | $1.75 | — | — | ✓ | — | — | — |
| ADDED Program (number input, calls/week) | $30/call | — | — | ✓ | — | — | — |

---

### Task 1: Create Commission Calculation Library

**Files:**
- Create: `app/lib/commission.ts`

This is the core logic — all pure functions, no React dependencies.

**Step 1: Create the file with all types, constants, and functions**

```ts
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
```

**Step 2: Create a test file and verify the math**

```ts
// app/lib/commission.test.ts
import { calcPay, AddOnState } from './commission';

const base: AddOnState = {
  vendorCerts: 0, entryLevelBGCerts: 0, entryLevelASE: 0,
  msha: false, forklift: false, pastExperienceYears: 0,
  saturdayRotation: false, commitmentBonus: false, cdl: false, addedCallsPerWeek: 0,
};

let passed = 0;
let failed = 0;
function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

console.log('Test 1: Service Tech, $15K billed');
{
  const r = calcPay('service-tech', false, { ...base, vendorCerts: 2, msha: true, pastExperienceYears: 6, saturdayRotation: true }, 15000);
  assert(r.effectiveHourly === 20.15, `effective $20.15/hr (18+0.50+0.50+1.00+0.15), got ${r.effectiveHourly}`);
  assert(r.commissionRate === 0.07, `commission 7%, got ${r.commissionRate}`);
  assert(r.weeklyCommission === 1050, `weekly commission $1050, got ${r.weeklyCommission}`);
  assert(r.weeklyTotal === 1856, `weekly total $1856, got ${r.weeklyTotal}`);
}

console.log('Test 2: Tire Tech, $5K billed (below threshold)');
{
  const r = calcPay('tire-tech', false, { ...base, vendorCerts: 1, entryLevelBGCerts: 1 }, 5000);
  assert(r.effectiveHourly === 18.50, `effective $18.50/hr, got ${r.effectiveHourly}`);
  assert(r.weeklyCommission === 0, `no commission, got ${r.weeklyCommission}`);
  assert(r.weeklyTotal === 740, `weekly $740, got ${r.weeklyTotal}`);
}

console.log('Test 3: Mechanic with tools, $25K billed');
{
  const r = calcPay('mechanic', true, { ...base, vendorCerts: 3, msha: true, forklift: true }, 25000);
  assert(r.basePay === 22, `base $22, got ${r.basePay}`);
  assert(r.commissionRate === 0.06, `commission 6%, got ${r.commissionRate}`);
}

console.log('Test 4: Warehouse (no commission)');
{
  const r = calcPay('warehouse', false, { ...base, msha: true, forklift: true, commitmentBonus: true }, 0);
  assert(r.effectiveHourly === 18.75, `effective $18.75/hr (18+0.50+0.25+0.25), got ${r.effectiveHourly}`);
  assert(r.weeklyCommission === 0, `no commission, got ${r.weeklyCommission}`);
}

console.log('Test 5: Lube with entry ASE + Saturday');
{
  const r = calcPay('lube', false, { ...base, entryLevelASE: 2, msha: true, saturdayRotation: true }, 0);
  assert(r.effectiveHourly === 15.15, `effective $15.15/hr (14+0.50+0.50+0.15), got ${r.effectiveHourly}`);
}

console.log('Test 6: Experience cap at 12 years');
{
  const r = calcPay('mechanic', false, { ...base, pastExperienceYears: 12 }, 0);
  assert(r.addOnsPerHour === 2, `add-ons $2.00/hr (cap), got ${r.addOnsPerHour}`);
}

console.log('Test 7: Experience beyond 12 years still capped');
{
  const r = calcPay('mechanic', false, { ...base, pastExperienceYears: 20 }, 0);
  assert(r.addOnsPerHour === 2, `add-ons $2.00/hr (cap), got ${r.addOnsPerHour}`);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

**Step 3: Run the test**

```bash
cd /home/kenny/AppDev/taketendash-employee-portal
npx tsx app/lib/commission.test.ts
```

Expected: `Results: 11 passed, 0 failed`

**Step 4: Remove the test file**

```bash
rm app/lib/commission.test.ts
```

**Step 5: Commit**

```bash
git add app/lib/commission.ts
git commit -m "feat: add commission calculation library"
```

---

### Task 2: Add Commission Page Nav Link

**Files:**
- Modify: `app/components/NavBar.tsx`

**Step 1: Add `DollarSign` import and nav link**

In the import line, add `DollarSign`:
```tsx
import { Settings, LogOut, Megaphone, Home, Calculator, LayoutDashboard, DollarSign } from 'lucide-react';
```

In the nav section, add the Commission link between Announcements and Pricing:
```tsx
{navLink('/commission', 'Commission', DollarSign)}
```

**Step 2: Commit**

```bash
git add app/components/NavBar.tsx
git commit -m "feat: add Commission nav link to NavBar"
```

---

### Task 3: Create Commission Page

**Files:**
- Create: `app/commission/page.tsx`

This is the main UI work. Follows the same patterns as `app/calculator/page.tsx`.

**Step 1: Create the page**

```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../components/useAuth';
import NavBar from '../components/NavBar';
import {
  Position,
  AddOnState,
  CommissionResult,
  calcPay,
  hasCommission,
} from '../lib/commission';

const POSITIONS: { key: Position; label: string }[] = [
  { key: 'mechanic', label: 'Mechanic' },
  { key: 'tire-tech', label: 'Tire Tech' },
  { key: 'service-tech', label: 'Service Tech' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'lube', label: 'Lube' },
  { key: 'retail', label: 'Retail' },
];

const VENDOR_CERT_MAXS: Record<string, number> = {
  'mechanic': 5,
  'tire-tech': 2,
  'service-tech': 5,
};

const defaultAddOns: AddOnState = {
  vendorCerts: 0,
  entryLevelBGCerts: 0,
  entryLevelASE: 0,
  msha: false,
  forklift: false,
  pastExperienceYears: 0,
  saturdayRotation: false,
  commitmentBonus: false,
  cdl: false,
  addedCallsPerWeek: 0,
};

function fmt(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtHourly(n: number): string {
  return '$' + n.toFixed(2);
}

function CertNumberInput({
  label, value, max, perUnit, onChange,
}: {
  label: string; value: number; max: number; perUnit: string; onChange: (v: number) => void;
}) {
  const effectiveMax = max > 0 ? max : 999;
  const displayMax = max > 0 ? ` (max ${max})` : '';
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-gray-300">{label}{displayMax}</div>
        <div className="text-xs text-gray-500">{perUnit}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-md bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 flex items-center justify-center text-sm transition-colors"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-white">{value}</span>
        <button
          onClick={() => onChange(max > 0 ? Math.min(max, value + 1) : value + 1)}
          className="w-7 h-7 rounded-md bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 flex items-center justify-center text-sm transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

function CertCheckbox({
  label, value, perUnit, onChange,
}: {
  label: string; value: boolean; perUnit: string; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(!value)}
          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
            value
              ? 'bg-red-600 border-red-600'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
        >
          {value && <span className="text-white text-xs">✓</span>}
        </button>
        <div>
          <div className="text-sm text-gray-300">{label}</div>
          <div className="text-xs text-gray-500">{perUnit}</div>
        </div>
      </div>
    </div>
  );
}

export default function CommissionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [position, setPosition] = useState<Position | null>(null);
  const [mechanicWithTools, setMechanicWithTools] = useState(true);
  const [retailIsManager, setRetailIsManager] = useState(false);
  const [addOns, setAddOns] = useState<AddOnState>(defaultAddOns);
  const [weeklyBilled, setWeeklyBilled] = useState('');

  const updateAddOn = <K extends keyof AddOnState>(key: K, value: AddOnState[K]) => {
    setAddOns(prev => ({ ...prev, [key]: value }));
  };

  // Reset add-ons when position changes
  useEffect(() => {
    if (position) setAddOns(defaultAddOns);
  }, [position]);

  // Commission result (computed)
  const result: CommissionResult | null = useMemo(() => {
    if (!position) return null;
    const billed = parseFloat(weeklyBilled) || 0;
    return calcPay(position, mechanicWithTools, addOns, billed);
  }, [position, mechanicWithTools, addOns, weeklyBilled]);

  // Determine which add-ons to show based on position
  const showVendorCerts = position === 'mechanic' || position === 'tire-tech' || position === 'service-tech';
  const showEntryBG = position === 'tire-tech';
  const showEntryASE = position === 'lube';
  const showForklift = position === 'mechanic' || position === 'service-tech' || position === 'warehouse' || position === 'lube' || position === 'retail';
  const showSaturday = position === 'mechanic' || position === 'tire-tech' || position === 'service-tech' || position === 'lube' || (position === 'retail' && !retailIsManager);
  const showCdl = position === 'service-tech';
  const showAdded = position === 'service-tech';

  if (authLoading || !user) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        <h1 className="text-xl font-bold text-white mb-1">Commission & Pay Calculator</h1>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Build a pay offer for a prospective employee</p>

        {/* Position selector */}
        <section className="mb-8">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Position
          </label>
          <div className="relative">
            <select
              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-10 font-semibold text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
              value={position || ''}
              onChange={e => setPosition(e.target.value as Position)}
            >
              <option value="" disabled>Select a position</option>
              {POSITIONS.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </section>

        {position && (
          <>
            {/* Role-specific toggles */}
            <section className="mb-8 space-y-4">
              {position === 'mechanic' && (
                <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
                  {([true, false] as const).map(withTools => (
                    <button
                      key={withTools ? 'tools' : 'no-tools'}
                      onClick={() => setMechanicWithTools(withTools)}
                      className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
                        mechanicWithTools === withTools
                          ? 'bg-red-600 text-white shadow'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {withTools ? 'With Tools ($22/hr)' : 'Without Tools ($18/hr)'}
                    </button>
                  ))}
                </div>
              )}
              {position === 'retail' && (
                <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
                  {([false, true] as const).map(isManager => (
                    <button
                      key={isManager ? 'mgr' : 'non-mgr'}
                      onClick={() => setRetailIsManager(isManager)}
                      className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
                        retailIsManager === isManager
                          ? 'bg-red-600 text-white shadow'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {isManager ? 'Manager' : 'Non-Manager'}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Certifications & Add-Ons */}
            <section className="mb-8 rounded-xl bg-gray-900 border border-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Certifications & Add-Ons
              </h2>

              <div className="space-y-4">
                {showVendorCerts && (
                  <CertNumberInput
                    label="ASE / BG / Tire Vendor Certs"
                    value={addOns.vendorCerts}
                    max={VENDOR_CERT_MAXS[position]}
                    perUnit="$0.25/hr each"
                    onChange={v => updateAddOn('vendorCerts', v)}
                  />
                )}
                {showEntryBG && (
                  <CertNumberInput
                    label="Entry Level BG Certs"
                    value={addOns.entryLevelBGCerts}
                    max={2}
                    perUnit="$0.25/hr each"
                    onChange={v => updateAddOn('entryLevelBGCerts', v)}
                  />
                )}
                {showEntryASE && (
                  <CertNumberInput
                    label="Entry Level ASE Certs"
                    value={addOns.entryLevelASE}
                    max={2}
                    perUnit="$0.25/hr each"
                    onChange={v => updateAddOn('entryLevelASE', v)}
                  />
                )}

                <CertCheckbox
                  label="MSHA Certification"
                  value={addOns.msha}
                  perUnit="$0.50/hr"
                  onChange={v => updateAddOn('msha', v)}
                />
                {showForklift && (
                  <CertCheckbox
                    label="Forklift Certification"
                    value={addOns.forklift}
                    perUnit="$0.25/hr"
                    onChange={v => updateAddOn('forklift', v)}
                  />
                )}

                <CertNumberInput
                  label="Past Professional Experience"
                  value={addOns.pastExperienceYears}
                  max={12}
                  perUnit="$0.50/hr per 3 years (max 12yr / $2.00)"
                  onChange={v => updateAddOn('pastExperienceYears', v)}
                />

                {showSaturday && (
                  <CertCheckbox
                    label="Saturday Rotation"
                    value={addOns.saturdayRotation}
                    perUnit="$0.15/hr"
                    onChange={v => updateAddOn('saturdayRotation', v)}
                  />
                )}

                <CertCheckbox
                  label="Commitment Bonus (6+ years)"
                  value={addOns.commitmentBonus}
                  perUnit="$0.25/hr"
                  onChange={v => updateAddOn('commitmentBonus', v)}
                />

                {showCdl && (
                  <CertCheckbox
                    label="CDL / LgOTR"
                    value={addOns.cdl}
                    perUnit="$1.75/hr"
                    onChange={v => updateAddOn('cdl', v)}
                  />
                )}

                {showAdded && (
                  <CertNumberInput
                    label="ADDED Program (after-hours calls/week)"
                    value={addOns.addedCallsPerWeek}
                    max={0}
                    perUnit="$30/call"
                    onChange={v => updateAddOn('addedCallsPerWeek', v)}
                  />
                )}
              </div>
            </section>

            {/* Weekly Production (commission roles only) */}
            {hasCommission(position) && (
              <section className="mb-8">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Weekly Production
                </label>
                <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus-within:border-red-500 transition-colors">
                  <span className="text-red-500 text-2xl font-black leading-none select-none">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={weeklyBilled}
                    onChange={e => setWeeklyBilled(e.target.value)}
                    className="flex-1 bg-transparent text-xl font-bold text-white placeholder-gray-600 focus:outline-none
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {position === 'service-tech'
                    ? 'Total labor billed (commission starts at $7,000/week)'
                    : 'Total labor + parts billed (commission starts at $14,000/week)'}
                </p>
              </section>
            )}

            {/* Pay Summary */}
            {result && (
              <section className="rounded-xl bg-gray-900 border border-red-500/40 p-6">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                  Pay Offer Summary
                </h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Base Rate</span>
                    <span className="text-white font-semibold">{fmtHourly(result.basePay)}/hr</span>
                  </div>
                  {result.addOnsPerHour > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Add-Ons</span>
                      <span className="text-green-400 font-semibold">+{fmtHourly(result.addOnsPerHour)}/hr</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-300 font-semibold">Effective Hourly</span>
                    <span className="text-white font-bold">{fmtHourly(result.effectiveHourly)}/hr</span>
                  </div>

                  {hasCommission(position) && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-gray-800">
                        <span className="text-gray-400">Weekly Base Pay (40hr)</span>
                        <span className="text-white font-semibold">{fmt(result.weeklyBasePay)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Commission ({(result.commissionRate * 100).toFixed(1)}%)</span>
                        <span className="text-green-400 font-semibold">{fmt(result.weeklyCommission)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between pt-3 border-t border-gray-700">
                    <span className="text-white font-bold text-lg">Total Weekly Pay</span>
                    <span className="text-red-500 font-black text-lg">{fmt(result.weeklyTotal)}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-gray-500 text-xs">Annualized</span>
                    <span className="text-gray-400 text-xs font-semibold">{fmt(result.annualized)}/yr</span>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {!position && (
          <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest">
              Select a position to start building a pay offer
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Verify the page builds**

```bash
cd /home/kenny/AppDev/taketendash-employee-portal
npm run build 2>&1 | tail -20
```

Expected: Successful build with no errors. If there are TypeScript errors, fix them before proceeding.

**Step 3: Verify the page works in dev**

```bash
npm run dev
```

Then visit `http://localhost:3000/commission` and test these scenarios:

1. **Service Tech**, 2 vendor certs, MSHA, 6yr experience, Saturday → $15K/week → ~$1,856/week total
2. **Mechanic (with tools)**, 3 vendor certs, MSHA, Forklift → $28K/week → should hit 7% tier
3. **Tire Tech**, 1 vendor cert, 1 entry BG → $5K/week → $0 commission (below threshold)
4. **Warehouse**, Forklift + MSHA + Commitment → no commission section visible
5. **Lube**, 2 Entry ASE, MSHA, Saturday → no commission section visible
6. **Retail (Manager)** → Saturday should NOT appear
7. **Retail (Non-Manager)** → Saturday should appear

**Step 4: Commit**

```bash
git add app/commission/page.tsx
git commit -m "feat: add commission & pay calculator page"
```

---

### Task 4: Final Verification & Polish

**Step 1: Verify edge cases**

- Below-threshold production shows $0 commission
- Annualized is always weekly × 52
- Changing position resets all add-ons
- Mechanic toggle switches between $18 and $22 base
- Retail Manager/Non-Manager toggle controls Saturday visibility

**Step 2: Fix any issues found**

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: polish commission calculator based on testing"
```
(Only if changes were needed.)

---

### Styling Reference

All styling follows existing conventions from `app/calculator/page.tsx`:

- **Labels:** `block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2`
- **Inputs:** `bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500`
- **Buttons (primary):** `bg-red-600 hover:bg-red-700 text-white`
- **Buttons (secondary):** `bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400`
- **Cards:** `bg-gray-900 border border-gray-800 rounded-xl p-5`
- **Result card:** `bg-gray-900 border border-red-500/40 rounded-xl p-6`
- **Toggle groups:** `flex gap-1 p-1 bg-gray-800 rounded-lg`
- **Section spacing:** `space-y-4` for vertical stacking
- **Typography:** Inter font (global), headings `text-xl font-bold`, body `text-sm`

### Auth Reference

- Use `useAuth()` from `app/components/useAuth.ts` — auto-redirects to `/login` if not authenticated
- Any logged-in employee portal user can access this page (store managers are the target)
- If admin-only is needed later, add `isAdmin(user)` check similar to `/settings`
