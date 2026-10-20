"use client";

import { useState } from "react";
import type { Bin, Location } from "@/lib/workflow/flow/types";

export function BinPicker({
  bins,
  locations,
  value,
  onChange,
  onManageBins,
}: {
  bins: Bin[];
  locations: Location[];
  value: string | undefined;
  onChange: (binId: string | undefined) => void;
  onManageBins?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeBin = bins.find((b) => b.id === value);
  const activeLocation = activeBin ? locations.find((l) => l.id === activeBin.locationId) : undefined;

  const grouped = locations.map((loc) => ({
    location: loc,
    bins: bins.filter((b) => b.locationId === loc.id),
  }));

  return (
    <div className="absolute -left-2 -top-2 z-10">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={
          activeBin
            ? "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md nodrag"
            : "flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white text-[10px] font-bold text-transparent opacity-0 shadow-sm nodrag transition-opacity group-hover:opacity-100 group-hover:text-slate-300"
        }
        style={activeBin ? { backgroundColor: activeBin.color } : undefined}
        title={activeBin ? `${activeBin.name} (${activeLocation?.letter ?? "?"})` : "Assign bin"}
      >
        {activeBin ? activeLocation?.letter ?? "" : "+"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="nodrag absolute left-0 top-8 z-20 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${
                !value ? "font-medium text-slate-900" : "text-slate-500"
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-100" />
              No bin
            </button>
            {grouped.map(
              ({ location, bins: locBins }) =>
                locBins.length > 0 && (
                  <div key={location.id} className="mt-1">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {location.letter} · {location.name}
                    </div>
                    {locBins.map((bin) => (
                      <button
                        key={bin.id}
                        type="button"
                        onClick={() => {
                          onChange(bin.id);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${
                          value === bin.id ? "font-medium text-slate-900" : "text-slate-600"
                        }`}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bin.color }} />
                        <span className="truncate">{bin.name}</span>
                      </button>
                    ))}
                  </div>
                ),
            )}
            {onManageBins && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onManageBins();
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50"
                >
                  Manage bins...
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
