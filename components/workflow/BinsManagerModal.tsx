"use client";

import { useState } from "react";
import type { Bin, Location } from "@/lib/workflow/flow/types";
import { NODE_COLORS } from "@/components/workflow/canvas/ColorPicker";

const BIN_COLORS = NODE_COLORS.filter((c) => c.value).map((c) => c.value as string);

export function BinsManagerModal({
  locations,
  bins,
  onCreateLocation,
  onUpdateLocation,
  onDeleteLocation,
  onCreateBin,
  onUpdateBin,
  onDeleteBin,
  onClose,
}: {
  locations: Location[];
  bins: Bin[];
  onCreateLocation: (location: { letter: string; name: string }) => void;
  onUpdateLocation: (id: string, patch: { letter?: string; name?: string }) => void;
  onDeleteLocation: (id: string) => void;
  onCreateBin: (bin: { name: string; color: string; locationId: string }) => void;
  onUpdateBin: (id: string, patch: { name?: string; color?: string; locationId?: string }) => void;
  onDeleteBin: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"locations" | "bins">("locations");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Manage Locations & Bins</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
          <button
            onClick={() => setTab("locations")}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
              tab === "locations" ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Locations
          </button>
          <button
            onClick={() => setTab("bins")}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
              tab === "bins" ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Bins
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "locations" ? (
            <LocationsTab locations={locations} onCreate={onCreateLocation} onUpdate={onUpdateLocation} onDelete={onDeleteLocation} />
          ) : (
            <BinsTab
              bins={bins}
              locations={locations}
              onCreate={onCreateBin}
              onUpdate={onUpdateBin}
              onDelete={onDeleteBin}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LocationsTab({
  locations,
  onCreate,
  onUpdate,
  onDelete,
}: {
  locations: Location[];
  onCreate: (location: { letter: string; name: string }) => void;
  onUpdate: (id: string, patch: { letter?: string; name?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [letter, setLetter] = useState("");
  const [name, setName] = useState("");

  function submitCreate() {
    if (!letter.trim() || !name.trim()) return;
    onCreate({ letter: letter.trim(), name: name.trim() });
    setLetter("");
    setName("");
    setCreating(false);
  }

  return (
    <>
      {locations.length === 0 && !creating && <p className="py-4 text-center text-sm text-slate-400">No locations yet.</p>}

      <div className="flex flex-col gap-2">
        {locations.map((loc) => (
          <LocationRow key={loc.id} location={loc} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>

      {creating ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex gap-2">
            <input
              autoFocus
              value={letter}
              onChange={(e) => setLetter(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="A"
              maxLength={2}
              className="w-16 rounded border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Location name (e.g. Warehouse)"
              className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={!letter.trim() || !name.trim()}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Add location
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + Add location
        </button>
      )}
    </>
  );
}

function LocationRow({
  location,
  onUpdate,
  onDelete,
}: {
  location: Location;
  onUpdate: (id: string, patch: { letter?: string; name?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [letter, setLetter] = useState(location.letter);
  const [name, setName] = useState(location.name);

  function submit() {
    onUpdate(location.id, { letter: letter.trim() || location.letter, name: name.trim() || location.name });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 flex gap-2">
          <input
            autoFocus
            value={letter}
            onChange={(e) => setLetter(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            className="w-16 rounded border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={submit} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-slate-200 p-3">
      <button onClick={() => setEditing(true)} className="flex flex-1 items-center gap-2.5 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white">
          {location.letter}
        </span>
        <div className="text-sm font-medium text-slate-900">{location.name}</div>
      </button>
      <button
        onClick={() => onDelete(location.id)}
        className="ml-2 rounded px-2 py-1 text-xs text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
      >
        Delete
      </button>
    </div>
  );
}

function BinsTab({
  bins,
  locations,
  onCreate,
  onUpdate,
  onDelete,
}: {
  bins: Bin[];
  locations: Location[];
  onCreate: (bin: { name: string; color: string; locationId: string }) => void;
  onUpdate: (id: string, patch: { name?: string; color?: string; locationId?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(BIN_COLORS[0]);
  const [locationId, setLocationId] = useState<string>(locations[0]?.id ?? "");

  function submitCreate() {
    if (!name.trim() || !locationId) return;
    onCreate({ name: name.trim(), color, locationId });
    setName("");
    setColor(BIN_COLORS[0]);
    setCreating(false);
  }

  if (locations.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">Add a location first before creating bins.</p>;
  }

  return (
    <>
      {bins.length === 0 && !creating && <p className="py-4 text-center text-sm text-slate-400">No bins yet.</p>}

      <div className="flex flex-col gap-2">
        {bins.map((bin) => (
          <BinRow key={bin.id} bin={bin} locations={locations} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>

      {creating ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bin name (e.g. Pending Review)"
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.letter} · {loc.name}
              </option>
            ))}
          </select>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {BIN_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border border-black/10"
                style={{ backgroundColor: c, outline: color === c ? "2px solid #3b82f6" : undefined, outlineOffset: 1 }}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={!name.trim()}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Add bin
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + Add bin
        </button>
      )}
    </>
  );
}

function BinRow({
  bin,
  locations,
  onUpdate,
  onDelete,
}: {
  bin: Bin;
  locations: Location[];
  onUpdate: (id: string, patch: { name?: string; color?: string; locationId?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bin.name);
  const [locationId, setLocationId] = useState(bin.locationId);
  const location = locations.find((l) => l.id === bin.locationId);

  function submit() {
    onUpdate(bin.id, { name: name.trim() || bin.name, locationId });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.letter} · {loc.name}
            </option>
          ))}
        </select>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {BIN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate(bin.id, { color: c })}
              className="h-6 w-6 rounded-full border border-black/10"
              style={{ backgroundColor: c, outline: bin.color === c ? "2px solid #3b82f6" : undefined, outlineOffset: 1 }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={submit} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-slate-200 p-3">
      <button onClick={() => setEditing(true)} className="flex flex-1 items-center gap-2.5 text-left">
        <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: bin.color }} />
        <div>
          <div className="text-sm font-medium text-slate-900">{bin.name}</div>
          <div className="text-xs text-slate-400">{location ? `${location.letter} · ${location.name}` : "Unknown location"}</div>
        </div>
      </button>
      <button
        onClick={() => onDelete(bin.id)}
        className="ml-2 rounded px-2 py-1 text-xs text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
      >
        Delete
      </button>
    </div>
  );
}
