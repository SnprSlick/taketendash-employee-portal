'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import { useAuth } from '../components/useAuth';
import NavBar from '../components/NavBar';

interface PricingMatrix {
  id: string;
  name: string;
  label: string;
  tiers: number[][];
  sortOrder: number;
}

function calcSellPrice(tiers: number[][], cost: number): number | null {
  for (const [low, high, margin] of tiers) {
    if (cost >= low && cost <= high) {
      return cost / (1 - margin / 100);
    }
  }
  return null;
}

function fmt(n: number): string {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function CalculatorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [matrices, setMatrices] = useState<PricingMatrix[]>([]);
  const [loadingMatrices, setLoadingMatrices] = useState(true);
  const [selectedMatrix, setSelectedMatrix] = useState<PricingMatrix | null>(null);
  const [cost, setCost] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<PricingMatrix[]>('/pricing-matrices')
      .then(data => {
        setMatrices(data);
        if (data.length > 0) setSelectedMatrix(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoadingMatrices(false));
  }, [user]);

  const costNum = parseFloat(cost);
  const isValidCost = cost !== '' && !isNaN(costNum) && costNum >= 0;
  const sellPrice = isValidCost && selectedMatrix
    ? calcSellPrice(selectedMatrix.tiers, costNum)
    : null;
  const margin = sellPrice ? ((sellPrice - costNum) / sellPrice * 100) : null;

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[#EAF1EB] flex flex-col">
      <NavBar />

      <main className="flex-1 flex flex-col items-center px-5 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-center font-bold text-xl text-[#201F1F] mb-1 tracking-tight">
            Non-Stock Pricing Calculator
          </h1>
          <p className="text-center text-xs text-[#666] uppercase tracking-widest mb-8">
            Cost → Sell Price
          </p>

          <div
            className="bg-white rounded-xl overflow-hidden shadow-lg"
            style={{ borderTop: '6px solid #EF1E24', border: '2px solid #ddd', borderTopColor: '#EF1E24' }}
          >
            <div className="p-6 space-y-6">

              {/* Category selector */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#EF1E24] mb-2">
                  Pricing Category
                </p>
                {loadingMatrices ? (
                  <div className="h-12 bg-[#EAF1EB] rounded-lg animate-pulse" />
                ) : (
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-[#EAF1EB] border-2 border-[#ddd] rounded-lg px-4 py-3 pr-10 font-bold text-sm text-[#201F1F] focus:outline-none focus:border-[#EF1E24] cursor-pointer"
                      value={selectedMatrix?.id || ''}
                      onChange={e => setSelectedMatrix(matrices.find(m => m.id === e.target.value) || null)}
                    >
                      {matrices.map(m => (
                        <option key={m.id} value={m.id}>{m.label || m.name}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#EF1E24] text-[9px]">▼</span>
                  </div>
                )}
              </div>

              <hr className="border-[#ddd]" />

              {/* Cost input */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#EF1E24] mb-2">
                  Your Cost
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[#EF1E24] text-4xl font-black leading-none">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    className="flex-1 bg-[#EAF1EB] border-2 border-[#ddd] rounded-lg px-4 py-3 text-xl font-bold text-[#201F1F] focus:outline-none focus:border-[#EF1E24]
                               [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Result */}
              <div>
                {!isValidCost || sellPrice === null ? (
                  <div className="bg-[#EAF1EB] border-2 border-dashed border-[#ddd] rounded-xl py-10 text-center">
                    <span className="text-3xl block mb-3">🧮</span>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#aaa]">
                      Enter a cost above
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#fde8e8] border-2 border-[#EF1E24] rounded-xl py-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#b81519] mb-2">
                      Suggested Sell Price
                    </p>
                    <p className="text-6xl font-black text-[#EF1E24] leading-none tracking-tight">
                      {fmt(sellPrice)}
                    </p>
                    <p className="text-xs text-[#b81519] mt-3 font-semibold">
                      {margin?.toFixed(1)}% margin &nbsp;·&nbsp; ${(sellPrice - costNum).toFixed(2)} GP
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Tier reference */}
          {selectedMatrix && (
            <details className="mt-6 bg-white rounded-xl border-2 border-[#ddd] overflow-hidden">
              <summary className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-[#666] cursor-pointer select-none">
                Tier reference — {selectedMatrix.label || selectedMatrix.name}
              </summary>
              <div className="px-5 pb-4">
                <table className="w-full text-xs mt-2">
                  <thead>
                    <tr className="text-[#aaa] border-b border-[#eee]">
                      <th className="text-left pb-1 pr-4">Cost Range</th>
                      <th className="text-left pb-1">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f5]">
                    {selectedMatrix.tiers.map(([low, high, margin], i) => {
                      const active = isValidCost && costNum >= low && costNum <= high;
                      return (
                        <tr key={i} className={active ? 'bg-[#fde8e8] font-bold text-[#EF1E24]' : 'text-[#666]'}>
                          <td className="py-1 pr-4">
                            {fmt(low)} – {high >= 9999 ? '∞' : fmt(high)}
                          </td>
                          <td className="py-1">{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
