'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../components/useAuth';
import NavBar from '../components/NavBar';
import {
  Position,
  AddOnState,
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

const SERVICE_TECH_TIERS: { min: number; max: number; rate: number }[] = [
  { min: 7000, max: 9999, rate: 0.04 },
  { min: 10000, max: 12499, rate: 0.05 },
  { min: 12500, max: 14999, rate: 0.06 },
  { min: 15000, max: 19999, rate: 0.07 },
  { min: 20000, max: Infinity, rate: 0.085 },
];

const NON_FLAG_TIERS: { min: number; max: number; rate: number }[] = [
  { min: 14000, max: 15999, rate: 0.02 },
  { min: 16000, max: 17999, rate: 0.03 },
  { min: 18000, max: 21999, rate: 0.04 },
  { min: 22000, max: 23999, rate: 0.05 },
  { min: 24000, max: 27999, rate: 0.06 },
  { min: 28000, max: Infinity, rate: 0.07 },
];

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
  retreadCert: false,
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
    <div className="flex items-center">
      <div className="flex-1">
        <div className="text-sm text-gray-300">{label}</div>
        <div className="text-xs text-gray-500">{perUnit}</div>
      </div>
      <div className="ml-4 shrink-0">
        <button
          onClick={() => onChange(!value)}
          className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${
            value
              ? 'bg-red-600 border-red-600'
              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
          }`}
        >
          {value && <span className="text-white text-xs">✓</span>}
        </button>
      </div>
    </div>
  );
}

// In-header production slider – appears when a tier is selected
function HeaderSlider({
  tier,
  value,
  onChange,
  onDismiss,
  result,
}: {
  tier: { min: number; max: number; rate: number };
  value: number;
  onChange: (v: number) => void;
  onDismiss: () => void;
  result: ReturnType<typeof calcPay>;
}) {
  const isInfinity = tier.max === Infinity;

  // Infinity tier: show static commission at min value with + indicator, no slider
  if (isInfinity) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3 h-3 text-red-400" />
            <span className="text-xs text-gray-400">{fmt(tier.min)}+</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400 font-semibold">{fmt(tier.min * tier.rate)} comm</span>
            <span className="text-red-500 font-bold">{fmt(result.weeklyTotal)} total</span>
            <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pct = ((value - tier.min) / (tier.max - tier.min)) * 100;

  return (
    <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3 h-3 text-red-400" />
          <span className="text-xs text-gray-400">{fmt(tier.min)} – {fmt(tier.max)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-red-400">{fmt(value)}</span>
          <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="absolute inset-0 h-1.5 rounded-full bg-gray-800" />
        <div
          className="absolute top-0 left-0 h-1.5 rounded-full bg-red-600 transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={tier.min}
          max={tier.max}
          step={50}
          value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="relative w-full h-1.5 opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-green-400">{fmt(tier.min * tier.rate)} comm</span>
        <span className="text-red-500 font-bold">{fmt(result.weeklyTotal)} total</span>
        <span className="text-green-400">{fmt(tier.max * tier.rate)} comm</span>
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

  // Slider state
  const [sliderTier, setSliderTier] = useState<number | null>(null);
  const [sliderValue, setSliderValue] = useState(0);

  const updateAddOn = <K extends keyof AddOnState>(key: K, value: AddOnState[K]) => {
    setAddOns(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (position) {
      setAddOns(defaultAddOns);
      setSliderTier(null);
      setSliderValue(0);
    }
  }, [position]);

  const currentBilled = sliderTier !== null
    ? sliderValue
    : (parseFloat(weeklyBilled) || 0);

  const result = useMemo(() => {
    if (!position) return null;
    return calcPay(position, mechanicWithTools, addOns, currentBilled);
  }, [position, mechanicWithTools, addOns, currentBilled]);

  const showForklift = position === 'mechanic' || position === 'service-tech' || position === 'warehouse' || position === 'lube' || position === 'retail';
  const showSaturday = position === 'mechanic' || position === 'tire-tech' || position === 'service-tech' || position === 'lube' || (position === 'retail' && !retailIsManager);
  const showCdl = position === 'service-tech';
  const showAdded = position === 'service-tech';

  const certLabels: Record<string, { label: string; max: number }> = {
    'mechanic': { label: 'ASE or Similar', max: 5 },
    'tire-tech': { label: 'BG or Tire Vendor Certs', max: 2 },
    'service-tech': { label: 'BG/TIA/MAC', max: 3 },
    'lube': { label: 'Entry Level ASE or BG', max: 2 },
    'retail': { label: 'BG or Tire Vendor', max: 2 },
  };
  const certInfo = position ? certLabels[position] : null;

  const tiers = position === 'service-tech' ? SERVICE_TECH_TIERS : (position && hasCommission(position) ? NON_FLAG_TIERS : []);

  function activateSlider(tierIdx: number) {
    const t = tiers[tierIdx];
    setSliderTier(tierIdx);
    setSliderValue(t.min);
  }

  function deactivateSlider() {
    setSliderTier(null);
    setSliderValue(0);
  }

  if (authLoading || !user) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-xl font-bold text-white mb-1">Commission & Pay Calculator</h1>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Build a pay offer for a prospective employee</p>

        {/* Sticky Pay Summary Header – ALL pay info consolidated here */}
        {position && result && (
          <div className="sticky top-16 z-30 mb-6 rounded-xl bg-gray-900 border border-red-500/60 shadow-lg shadow-black/30 p-4 sm:p-5 space-y-3">
            {/* Row 1: Hourly */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-widest">Base</div>
                  <div className="text-sm font-semibold text-white">{fmtHourly(result.basePay)}/hr</div>
                </div>
                {result.addOnsPerHour > 0 && (
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Add-Ons</div>
                    <div className="text-sm font-semibold text-green-400">+{fmtHourly(result.addOnsPerHour)}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase tracking-widest">Effective</div>
                  <div className="text-sm font-bold text-white">{fmtHourly(result.effectiveHourly)}/hr</div>
                </div>
              </div>
              <div className="border-l border-gray-800 pl-3 sm:pl-4 text-right">
                <div className="text-xs text-gray-500 uppercase tracking-widest">Total Weekly</div>
                <div className="text-red-500 font-black text-lg sm:text-xl">{fmt(result.weeklyTotal)}</div>
                <div className="text-gray-500 text-xs">{fmt(result.annualized)}/yr</div>
              </div>
            </div>

            {/* Row 2: Commission breakdown */}
            {hasCommission(position) && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800 text-xs">
                <span className="text-gray-400">
                  <span className="text-white">{fmt(result.weeklyBasePay)}</span> weekly base
                  {' · '}
                  <span className="text-green-400">{fmt(result.weeklyCommission)}</span> comm ({(result.commissionRate * 100).toFixed(1)}%)
                </span>
                <span className="text-gray-500">@ {fmt(currentBilled)} production</span>
              </div>
            )}

            {/* Row 3: Production slider when a tier is active */}
            {sliderTier !== null && hasCommission(position) && (
              <HeaderSlider
                tier={tiers[sliderTier]}
                value={sliderValue}
                onChange={setSliderValue}
                onDismiss={deactivateSlider}
                result={result}
              />
            )}
          </div>
        )}

        {/* Position selector */}
        <section className="mb-6 sm:mb-8">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Position
          </label>
          <div className="relative">
            <select
              className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-10 font-semibold text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
              value={position || ''}
              onChange={e => {
                setPosition(e.target.value as Position);
                setWeeklyBilled('');
                setSliderTier(null);
                setSliderValue(0);
              }}
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
            <section className="mb-6 sm:mb-8 space-y-3">
              {position === 'mechanic' && (
                <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
                  {([true, false] as const).map(withTools => (
                    <button
                      key={withTools ? 'tools' : 'no-tools'}
                      onClick={() => setMechanicWithTools(withTools)}
                      className={`px-3 sm:px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
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
                      className={`px-3 sm:px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
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
            <section className="mb-6 sm:mb-8 rounded-xl bg-gray-900 border border-gray-800 p-4 sm:p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                Certifications & Add-Ons
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {certInfo && certInfo.max > 0 && (
                  <CertNumberInput
                    label={certInfo.label}
                    value={addOns.vendorCerts}
                    max={certInfo.max}
                    perUnit="$0.25/hr each"
                    onChange={v => updateAddOn('vendorCerts', v)}
                  />
                )}
                <CertNumberInput
                  label="Years Experience"
                  value={addOns.pastExperienceYears}
                  max={12}
                  perUnit="$0.50/3yr"
                  onChange={v => updateAddOn('pastExperienceYears', v)}
                />
                {showAdded && (
                  <CertNumberInput
                    label="ADDED Calls/Week"
                    value={addOns.addedCallsPerWeek}
                    max={0}
                    perUnit="$30/call"
                    onChange={v => updateAddOn('addedCallsPerWeek', v)}
                  />
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  <CertCheckbox
                    label="MSHA"
                    value={addOns.msha}
                    perUnit="$0.50/hr"
                    onChange={v => updateAddOn('msha', v)}
                  />
                  {showForklift && (
                    <CertCheckbox
                      label="Forklift"
                      value={addOns.forklift}
                      perUnit="$0.25/hr"
                      onChange={v => updateAddOn('forklift', v)}
                    />
                  )}
                  {position === 'warehouse' && (
                    <CertCheckbox
                      label="Retread Cert"
                      value={addOns.retreadCert}
                      perUnit="$1.00/hr"
                      onChange={v => updateAddOn('retreadCert', v)}
                    />
                  )}
                  {showSaturday && (
                    <CertCheckbox
                      label="Saturday"
                      value={addOns.saturdayRotation}
                      perUnit="$0.15/hr"
                      onChange={v => updateAddOn('saturdayRotation', v)}
                    />
                  )}
                  <CertCheckbox
                    label="Commitment"
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
                </div>
              </div>
            </section>

            {/* Commission Tiers Table */}
            {hasCommission(position) && (
              <section className="mb-6 sm:mb-8">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Commission Tiers
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  {position === 'service-tech'
                    ? 'Total labor billed (commission starts at $7,000/week)'
                    : 'Total labor + parts billed (commission starts at $14,000/week)'}
                </p>
                {sliderTier === null && (
                  <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus-within:border-red-500 transition-colors mb-3">
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
                )}
                <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="text-left py-2 px-3 sm:px-4 font-semibold">Production Range</th>
                        <th className="text-center py-2 px-2 font-semibold">Rate</th>
                        <th className="text-right py-2 px-3 sm:px-4 font-semibold">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {tiers.map((tier, i) => {
                        const isActive = sliderTier === i;
                        const isCurrent = sliderTier === null && currentBilled >= tier.min && currentBilled <= tier.max;
                        const isInfinity = tier.max === Infinity;
                        const displayMax = isInfinity ? '+' : fmt(tier.max);
                        const commAtMin = fmt(tier.min * tier.rate);
                        const commAtMax = isInfinity
                          ? '+'
                          : fmt(tier.max * tier.rate);
                        return (
                          <tr
                            key={i}
                            className={`cursor-pointer transition-colors ${
                              isActive
                                ? 'bg-red-500/20'
                                : isCurrent
                                ? 'bg-red-500/10'
                                : 'hover:bg-gray-800'
                            }`}
                            onClick={() => activateSlider(i)}
                          >
                            <td className={`py-2 px-3 sm:px-4 ${isActive ? 'text-red-300 font-bold' : isCurrent ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                              {fmt(tier.min)} – {displayMax}
                            </td>
                            <td className={`py-2 px-2 text-center ${isActive ? 'text-red-300 font-bold' : isCurrent ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                              {(tier.rate * 100).toFixed(1)}%
                            </td>
                            <td className={`py-2 px-3 sm:px-4 text-right ${isActive ? 'text-red-300 font-bold' : isCurrent ? 'text-red-400 font-bold' : 'text-gray-600'}`}>
                              {commAtMin}{isInfinity ? '+' : ` – ${commAtMax}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
