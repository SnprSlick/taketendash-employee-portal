'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const displayMax = max > 0 ? ` (max ${max})` : '';
  const effectiveMax = max > 0 ? max : 999;
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
          onClick={() => onChange(effectiveMax > 0 ? Math.min(effectiveMax, value + 1) : value + 1)}
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
