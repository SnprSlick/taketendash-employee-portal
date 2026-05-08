'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../components/useAuth';
import NavBar from '../components/NavBar';

const WHOLESALE_ROLES = ['ADMINISTRATOR', 'CORPORATE', 'WHOLESALE'];

interface PricingMatrix {
  id: string;
  name: string;
  label: string;
  tiers: number[][];
  sortOrder: number;
}

function calcSellPrice(tiers: number[][], cost: number): number | null {
  for (const [low, high, margin] of tiers) {
    if (cost >= low && cost <= high) return cost / (1 - margin / 100);
  }
  return null;
}

function fmt(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function CalculatorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const canUseWholesale = user && WHOLESALE_ROLES.includes(user.role);
  const [calcType, setCalcType] = useState<'retail' | 'wholesale'>('retail');
  const [matrices, setMatrices] = useState<PricingMatrix[]>([]);
  const [loadingMatrices, setLoadingMatrices] = useState(true);
  const [selectedMatrix, setSelectedMatrix] = useState<PricingMatrix | null>(null);
  const [cost, setCost] = useState('');
  const [showTiers, setShowTiers] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingMatrices(true);
    setSelectedMatrix(null);
    setCost('');
    apiFetch<PricingMatrix[]>(`/pricing-matrices?type=${calcType}`)
      .then(data => {
        setMatrices(data);
        if (data.length > 0) setSelectedMatrix(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoadingMatrices(false));
  }, [user, calcType]);

  const costNum = parseFloat(cost);
  const isValidCost = cost !== '' && !isNaN(costNum) && costNum >= 0;
  const sellPrice = isValidCost && selectedMatrix ? calcSellPrice(selectedMatrix.tiers, costNum) : null;
  const grossProfit = sellPrice ? sellPrice - costNum : null;
  const marginPct = sellPrice ? ((sellPrice - costNum) / sellPrice * 100) : null;

  if (authLoading || !user) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  const pageTitle = calcType === 'wholesale' ? 'Wholesale Non-Stock Pricing' : 'Retail Non-Stock Pricing';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-10">
        <h1 className="text-xl font-bold text-white mb-1">{pageTitle}</h1>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-6">Cost → Sell Price Calculator</p>

        {/* Retail / Wholesale toggle — only for elevated roles */}
        {canUseWholesale && (
          <div className="flex gap-1 mb-8 p-1 bg-gray-800 rounded-lg">
            {(['retail', 'wholesale'] as const).map(type => (
              <button
                key={type}
                onClick={() => setCalcType(type)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold uppercase tracking-widest transition-colors ${
                  calcType === type
                    ? 'bg-red-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        {/* Category selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Pricing Category
          </label>
          {loadingMatrices ? (
            <div className="h-12 bg-gray-800 rounded-lg animate-pulse" />
          ) : matrices.length === 0 ? (
            <div className="h-12 bg-gray-800 rounded-lg flex items-center px-4 text-gray-500 text-sm">
              No {calcType} matrices configured yet.
            </div>
          ) : (
            <div className="relative">
              <select
                className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-10 font-semibold text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                value={selectedMatrix?.id || ''}
                onChange={e => {
                  setSelectedMatrix(matrices.find(m => m.id === e.target.value) || null);
                  setCost('');
                }}
              >
                {matrices.map(m => (
                  <option key={m.id} value={m.id} className="bg-gray-800">{m.label || m.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          )}
        </div>

        {/* Cost input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Your Cost
          </label>
          <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus-within:border-red-500 transition-colors">
            <span className="text-red-500 text-2xl font-black leading-none select-none">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={cost}
              onChange={e => setCost(e.target.value)}
              className="flex-1 bg-transparent text-xl font-bold text-white placeholder-gray-600 focus:outline-none
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Result */}
        {!isValidCost || sellPrice === null ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest">
              Enter a cost to see the sell price
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-gray-900 border border-red-500/40 p-6 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Suggested Sell Price
            </p>
            <p className="text-6xl font-black text-red-500 leading-none tracking-tight">
              {fmt(sellPrice)}
            </p>
            <div className="flex justify-center gap-6 mt-4 text-sm text-gray-400">
              <span>
                <span className="text-white font-semibold">{marginPct?.toFixed(1)}%</span> margin
              </span>
              <span className="text-gray-700">|</span>
              <span>
                <span className="text-white font-semibold">{fmt(grossProfit!)}</span> GP
              </span>
            </div>
          </div>
        )}

        {/* Tier reference toggle */}
        {selectedMatrix && (
          <div className="mt-5 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowTiers(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest hover:text-white transition-colors"
            >
              <span>Tier Reference — {selectedMatrix.label || selectedMatrix.name}</span>
              {showTiers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTiers && (
              <div className="px-5 pb-4 border-t border-gray-800">
                <table className="w-full text-xs mt-3">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 pr-4 font-semibold">Cost Range</th>
                      <th className="text-left pb-2 font-semibold">Margin</th>
                      <th className="text-right pb-2 font-semibold">GP @ Your Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {selectedMatrix.tiers.map(([low, high, tierMargin], i) => {
                      const active = isValidCost && costNum >= low && costNum <= high;
                      const exSell = isValidCost ? costNum / (1 - tierMargin / 100) : null;
                      return (
                        <tr key={i} className={active ? 'bg-red-500/10' : ''}>
                          <td className={`py-1.5 pr-4 ${active ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                            {fmt(low)} – {high >= 9999 ? '∞' : fmt(high)}
                          </td>
                          <td className={`py-1.5 ${active ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                            {tierMargin}%
                          </td>
                          <td className={`py-1.5 text-right ${active ? 'text-red-400 font-bold' : 'text-gray-600'}`}>
                            {exSell ? fmt(exSell - costNum) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

  const costNum = parseFloat(cost);
  const isValidCost = cost !== '' && !isNaN(costNum) && costNum >= 0;
  const sellPrice = isValidCost && selectedMatrix ? calcSellPrice(selectedMatrix.tiers, costNum) : null;
  const grossProfit = sellPrice ? sellPrice - costNum : null;
  const marginPct = sellPrice ? ((sellPrice - costNum) / sellPrice * 100) : null;

  if (authLoading || !user) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <NavBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-5 py-10">
        <h1 className="text-xl font-bold text-white mb-1">Retail Non-Stock Pricing</h1>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-8">Cost → Sell Price Calculator</p>

        {/* Category selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Pricing Category
          </label>
          {loadingMatrices ? (
            <div className="h-12 bg-gray-800 rounded-lg animate-pulse" />
          ) : (
            <div className="relative">
              <select
                className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-10 font-semibold text-sm text-white focus:outline-none focus:border-red-500 cursor-pointer"
                value={selectedMatrix?.id || ''}
                onChange={e => {
                  setSelectedMatrix(matrices.find(m => m.id === e.target.value) || null);
                  setCost('');
                }}
              >
                {matrices.map(m => (
                  <option key={m.id} value={m.id} className="bg-gray-800">{m.label || m.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          )}
        </div>

        {/* Cost input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Your Cost
          </label>
          <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus-within:border-red-500 transition-colors">
            <span className="text-red-500 text-2xl font-black leading-none select-none">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={cost}
              onChange={e => setCost(e.target.value)}
              className="flex-1 bg-transparent text-xl font-bold text-white placeholder-gray-600 focus:outline-none
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Result */}
        {!isValidCost || sellPrice === null ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest">
              Enter a cost to see the sell price
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-gray-900 border border-red-500/40 p-6 text-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Suggested Sell Price
            </p>
            <p className="text-6xl font-black text-red-500 leading-none tracking-tight">
              {fmt(sellPrice)}
            </p>
            <div className="flex justify-center gap-6 mt-4 text-sm text-gray-400">
              <span>
                <span className="text-white font-semibold">{marginPct?.toFixed(1)}%</span> margin
              </span>
              <span className="text-gray-700">|</span>
              <span>
                <span className="text-white font-semibold">{fmt(grossProfit!)}</span> GP
              </span>
            </div>
          </div>
        )}

        {/* Tier reference toggle */}
        {selectedMatrix && (
          <div className="mt-5 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            <button
              onClick={() => setShowTiers(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest hover:text-white transition-colors"
            >
              <span>Tier Reference — {selectedMatrix.label || selectedMatrix.name}</span>
              {showTiers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTiers && (
              <div className="px-5 pb-4 border-t border-gray-800">
                <table className="w-full text-xs mt-3">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 pr-4 font-semibold">Cost Range</th>
                      <th className="text-left pb-2 font-semibold">Margin</th>
                      <th className="text-right pb-2 font-semibold">GP @ Your Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {selectedMatrix.tiers.map(([low, high, tierMargin], i) => {
                      const active = isValidCost && costNum >= low && costNum <= high;
                      const exSell = isValidCost ? costNum / (1 - tierMargin / 100) : null;
                      return (
                        <tr key={i} className={active ? 'bg-red-500/10' : ''}>
                          <td className={`py-1.5 pr-4 ${active ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                            {fmt(low)} – {high >= 9999 ? '∞' : fmt(high)}
                          </td>
                          <td className={`py-1.5 ${active ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                            {tierMargin}%
                          </td>
                          <td className={`py-1.5 text-right ${active ? 'text-red-400 font-bold' : 'text-gray-600'}`}>
                            {exSell ? fmt(exSell - costNum) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
