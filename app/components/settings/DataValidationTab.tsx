'use client';

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../../lib/api';
import { Upload, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileSalesperson {
  mech1: string;
  siteNo: string;
  total_parts: number;
  total_labor: number;
  total_fet: number;
  total_sell: number;
  total_gp: number;
}

interface DbSalesperson {
  salesperson: string;
  salesperson_name: string;
  site_no: string;
  store_name: string;
  total_parts: number;
  total_labor: number;
  total_fet: number;
  total_sell: number;
  total_gp: number;
  invoice_count: number;
}

interface CompareRow {
  mech1: string;
  name: string;
  siteNo: string;
  storeName: string;
  file_parts: number;
  db_parts: number;
  file_labor: number;
  db_labor: number;
  file_fet: number;
  db_fet: number;
  file_sell: number;
  db_sell: number;
  file_gp: number;
  db_gp: number;
}

const STORE_MAP: Record<string, string> = {
  '2': 'Ponca City',
  '3': 'Tulsa West',
  '4': 'OKC',
  '5': 'Kansas City',
  '6': 'Tulsa East',
  '7': 'Fort Smith',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
}

function diffClass(diff: number): string {
  const abs = Math.abs(diff);
  if (abs < 1) return 'text-green-400';
  if (abs < 50) return 'text-yellow-400';
  return 'text-red-400 font-semibold';
}

function diffBg(diff: number): string {
  const abs = Math.abs(diff);
  if (abs < 1) return '';
  if (abs < 50) return 'bg-yellow-900/20';
  return 'bg-red-900/20';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DataValidationTab() {
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState<FileSalesperson[]>([]);
  const [availableSites, setAvailableSites] = useState<string[]>([]);
  const [autoMonth, setAutoMonth] = useState('');
  const [autoYear, setAutoYear] = useState('');

  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [siteNo, setSiteNo] = useState('all');

  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compared, setCompared] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parse Excel ────────────────────────────────────────────────────────────

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    setCompared(false);
    setCompareRows([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });

        const ws = wb.Sheets['Sales Data'];
        if (!ws) {
          setError('Could not find "Sales Data" sheet in the uploaded file.');
          return;
        }

        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        if (rows.length < 2) {
          setError('Sales Data sheet appears empty.');
          return;
        }

        // Map header columns by name
        const header = (rows[0] as (string | null)[]).map(h => String(h ?? '').toUpperCase().trim());
        const col = (name: string) => header.indexOf(name);

        const iMECH1 = col('MECH1');
        const iSITE = col('SITENO');
        const iINVDATE = col('INVDATE');
        const iAMOUNT = col('AMOUNT');
        const iLABOR = col('LABOR');
        const iFETAX = col('FETAX');
        const iFETCOST = col('FETCOST');
        const iCOST = col('COST');
        const iQTY = col('QTY');

        if (iMECH1 < 0 || iSITE < 0 || iAMOUNT < 0) {
          setError('Required columns (MECH1, SITENO, AMOUNT) not found in Sales Data sheet.');
          return;
        }

        // Aggregate by MECH1 + SITENO
        const agg = new Map<string, FileSalesperson>();
        const sites = new Set<string>();
        const dates: Date[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as (unknown)[];
          const mech1 = String(row[iMECH1] ?? '').trim();
          const site = String(row[iSITE] ?? '').trim();
          if (!mech1 || !site || mech1 === 'null' || mech1 === '') continue;

          sites.add(site);

          const qty = Number(row[iQTY] ?? 1);
          const amount = Number(row[iAMOUNT] ?? 0);
          const labor = Number(row[iLABOR] ?? 0);
          const fetax = Number(row[iFETAX] ?? 0);
          const fetcost = Number(row[iFETCOST] ?? 0);
          const cost = Number(row[iCOST] ?? 0);

          if (iINVDATE >= 0 && row[iINVDATE] instanceof Date) {
            dates.push(row[iINVDATE] as Date);
          }

          const key = `${mech1}|${site}`;
          const cur = agg.get(key) ?? { mech1, siteNo: site, total_parts: 0, total_labor: 0, total_fet: 0, total_sell: 0, total_gp: 0 };
          cur.total_parts += amount * qty;
          cur.total_labor += labor * qty;
          cur.total_fet += fetax * qty;
          cur.total_sell += (amount + labor + fetax) * qty;
          cur.total_gp += (amount * qty - cost) + (fetax * qty - fetcost) + (labor * qty);
          agg.set(key, cur);
        }

        const parsed = Array.from(agg.values());
        setFileData(parsed);
        setAvailableSites(Array.from(sites).sort());

        // Auto-detect month/year from invoice dates in the file
        if (dates.length > 0) {
          const d = dates[Math.floor(dates.length / 2)];
          const m = String(d.getMonth() + 1);
          const y = String(d.getFullYear());
          setAutoMonth(m);
          setAutoYear(y);
          setMonth(m);
          setYear(y);
        }
      } catch (err) {
        setError('Failed to parse Excel file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Compare ────────────────────────────────────────────────────────────────

  const handleCompare = async () => {
    if (!fileData.length) { setError('Upload an Excel file first.'); return; }
    if (!month || !year) { setError('Select a month and year.'); return; }

    setLoading(true);
    setError('');
    setCompared(false);

    try {
      let storeIdParam = '';
      if (siteNo !== 'all') {
        const stores = await apiFetch<{ id: string; code: string; name: string }[]>('/stores');
        const match = stores.find(s => s.code === siteNo);
        if (match) storeIdParam = `&storeId=${match.id}`;
      }

      const res = await apiFetch<{ success: boolean; data: DbSalesperson[] }>(
        `/invoices/reports/salesperson-validation?month=${month}&year=${year}${storeIdParam}`
      );

      const dbMap = new Map<string, DbSalesperson>();
      for (const d of res.data) {
        const key = `${d.salesperson}|${d.site_no ?? ''}`;
        dbMap.set(key, d);
        // Also index without site for fallback
        if (!dbMap.has(`${d.salesperson}|`)) dbMap.set(`${d.salesperson}|`, d);
      }

      const filteredFile = siteNo === 'all' ? fileData : fileData.filter(f => f.siteNo === siteNo);

      // Union of all MECH1+site keys from both sources
      const allKeys = new Set<string>();
      filteredFile.forEach(f => allKeys.add(`${f.mech1}|${f.siteNo}`));
      res.data.forEach(d => allKeys.add(`${d.salesperson}|${d.site_no ?? ''}`));

      const rows: CompareRow[] = Array.from(allKeys).map(key => {
        const [mech1, site] = key.split('|');
        const f = filteredFile.find(x => x.mech1 === mech1 && x.siteNo === site);
        const d = dbMap.get(key) ?? dbMap.get(`${mech1}|`);
        return {
          mech1,
          name: d?.salesperson_name ?? mech1,
          siteNo: site,
          storeName: d?.store_name ?? STORE_MAP[site] ?? `Site ${site}`,
          file_parts: f?.total_parts ?? 0,
          db_parts: d?.total_parts ?? 0,
          file_labor: f?.total_labor ?? 0,
          db_labor: d?.total_labor ?? 0,
          file_fet: f?.total_fet ?? 0,
          db_fet: d?.total_fet ?? 0,
          file_sell: f?.total_sell ?? 0,
          db_sell: d?.total_sell ?? 0,
          file_gp: f?.total_gp ?? 0,
          db_gp: d?.total_gp ?? 0,
        };
      }).sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return (a.siteNo ?? '').localeCompare(b.siteNo ?? '');
      });

      setCompareRows(rows);
      setCompared(true);
    } catch (err) {
      setError('Compare failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // ── Summary Totals ─────────────────────────────────────────────────────────

  const totals = compareRows.reduce(
    (acc, r) => ({
      file_parts: acc.file_parts + r.file_parts,
      db_parts: acc.db_parts + r.db_parts,
      file_labor: acc.file_labor + r.file_labor,
      db_labor: acc.db_labor + r.db_labor,
      file_sell: acc.file_sell + r.file_sell,
      db_sell: acc.db_sell + r.db_sell,
      file_gp: acc.file_gp + r.file_gp,
      db_gp: acc.db_gp + r.db_gp,
    }),
    { file_parts: 0, db_parts: 0, file_labor: 0, db_labor: 0, file_sell: 0, db_sell: 0, file_gp: 0, db_gp: 0 }
  );

  const monthOptions = [
    { v: '1', l: 'January' }, { v: '2', l: 'February' }, { v: '3', l: 'March' },
    { v: '4', l: 'April' }, { v: '5', l: 'May' }, { v: '6', l: 'June' },
    { v: '7', l: 'July' }, { v: '8', l: 'August' }, { v: '9', l: 'September' },
    { v: '10', l: 'October' }, { v: '11', l: 'November' }, { v: '12', l: 'December' },
  ];
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(String);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-950/40 border border-blue-700/40 rounded-xl p-4 text-sm text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          Upload an <strong>Outside Sales Commission Compare</strong> .xlsx file. The comparison groups by{' '}
          <strong>MECH1</strong> (service advisor per line item) and SITENO from the Sales Data sheet.
          The file is parsed entirely in your browser — nothing is uploaded to the server.
        </div>
      </div>

      {/* Upload + Filters card */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">1 · Upload &amp; Configure</h3>

        {/* File drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-600 hover:border-red-500 rounded-xl p-6 text-center cursor-pointer transition-colors group"
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500 group-hover:text-red-400 transition-colors" />
          {fileName
            ? <p className="text-sm text-green-400 font-medium">{fileName}</p>
            : <p className="text-sm text-gray-400">Click to upload .xlsx</p>
          }
          {fileData.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{fileData.length} salesperson/store combinations parsed</p>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>

        {/* Month / Year / Store filters */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Month</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">Select month</option>
              {monthOptions.map(m => (
                <option key={m.v} value={m.v}>
                  {m.l}{autoMonth === m.v ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Year</label>
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="">Select year</option>
              {yearOptions.map(y => (
                <option key={y} value={y}>
                  {y}{autoYear === y ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Store (SITENO)</label>
            <select
              value={siteNo}
              onChange={e => setSiteNo(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All Stores</option>
              {availableSites.map(s => (
                <option key={s} value={s}>{STORE_MAP[s] ?? `Site ${s}`} (#{s})</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !fileData.length}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {loading ? 'Comparing…' : 'Compare'}
        </button>

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {compared && compareRows.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              2 · Results — {compareRows.length} salesperson/store rows
            </h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &lt;$1 match</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> $1–$50 variance</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;$50 variance</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-gray-800 text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Salesperson</th>
                  <th className="px-3 py-3 text-center">ID</th>
                  <th className="px-3 py-3 text-center">Store</th>
                  <th className="px-3 py-3 text-right border-l border-gray-700">Parts (File)</th>
                  <th className="px-3 py-3 text-right">Parts (DB)</th>
                  <th className="px-3 py-3 text-right">Parts Δ</th>
                  <th className="px-3 py-3 text-right border-l border-gray-700">Labor (File)</th>
                  <th className="px-3 py-3 text-right">Labor (DB)</th>
                  <th className="px-3 py-3 text-right">Labor Δ</th>
                  <th className="px-3 py-3 text-right border-l border-gray-700">Total (File)</th>
                  <th className="px-3 py-3 text-right">Total (DB)</th>
                  <th className="px-3 py-3 text-right">Total Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-gray-300">
                {compareRows.map((row, i) => {
                  const dParts = row.db_parts - row.file_parts;
                  const dLabor = row.db_labor - row.file_labor;
                  const dSell = row.db_sell - row.file_sell;
                  return (
                    <tr key={i} className={`hover:bg-gray-800/50 transition-colors ${diffBg(dSell)}`}>
                      <td className="px-4 py-2.5 font-medium">{row.name}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{row.mech1}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{row.storeName}</td>
                      <td className="px-3 py-2.5 text-right border-l border-gray-800">{fmt(row.file_parts)}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(row.db_parts)}</td>
                      <td className={`px-3 py-2.5 text-right ${diffClass(dParts)}`}>{dParts >= 0 ? '+' : ''}{fmt(dParts)}</td>
                      <td className="px-3 py-2.5 text-right border-l border-gray-800">{fmt(row.file_labor)}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(row.db_labor)}</td>
                      <td className={`px-3 py-2.5 text-right ${diffClass(dLabor)}`}>{dLabor >= 0 ? '+' : ''}{fmt(dLabor)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold border-l border-gray-800">{fmt(row.file_sell)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{fmt(row.db_sell)}</td>
                      <td className={`px-3 py-2.5 text-right ${diffClass(dSell)}`}>{dSell >= 0 ? '+' : ''}{fmt(dSell)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>TOTAL</td>
                  <td className="px-3 py-3 text-right border-l border-gray-700">{fmt(totals.file_parts)}</td>
                  <td className="px-3 py-3 text-right">{fmt(totals.db_parts)}</td>
                  <td className={`px-3 py-3 text-right ${diffClass(totals.db_parts - totals.file_parts)}`}>
                    {totals.db_parts - totals.file_parts >= 0 ? '+' : ''}{fmt(totals.db_parts - totals.file_parts)}
                  </td>
                  <td className="px-3 py-3 text-right border-l border-gray-700">{fmt(totals.file_labor)}</td>
                  <td className="px-3 py-3 text-right">{fmt(totals.db_labor)}</td>
                  <td className={`px-3 py-3 text-right ${diffClass(totals.db_labor - totals.file_labor)}`}>
                    {totals.db_labor - totals.file_labor >= 0 ? '+' : ''}{fmt(totals.db_labor - totals.file_labor)}
                  </td>
                  <td className="px-3 py-3 text-right border-l border-gray-700">{fmt(totals.file_sell)}</td>
                  <td className="px-3 py-3 text-right">{fmt(totals.db_sell)}</td>
                  <td className={`px-3 py-3 text-right ${diffClass(totals.db_sell - totals.file_sell)}`}>
                    {totals.db_sell - totals.file_sell >= 0 ? '+' : ''}{fmt(totals.db_sell - totals.file_sell)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {compared && compareRows.length === 0 && (
        <div className="text-center text-gray-500 py-12 text-sm">No data found for the selected period and store.</div>
      )}
    </div>
  );
}
