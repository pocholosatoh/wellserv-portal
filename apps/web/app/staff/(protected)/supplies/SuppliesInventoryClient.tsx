"use client";

import { useEffect, useMemo, useState } from "react";

type PackagingType = "box" | "bundle" | "pack" | "bag" | "bottle";

type NextExpiry = {
  expiry_date: string;
  remaining_pcs: number;
};

type InventoryItem = {
  item_id: string;
  item_name: string;
  packaging_type: PackagingType | null;
  pcs_per_package: number | null;
  total_pcs_all: number | null;
  remaining_pcs_all: number | null;
  total_pcs_available: number | null;
  remaining_pcs_available: number | null;
  nearest_expiry_date: string | null;
  active_batches_count: number | null;
  next_expiries: NextExpiry[];
};

type Notice = { type: "success" | "error"; message: string };

type GlobalItem = InventoryItem;

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function toPositiveInt(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n <= 0) return null;
  return n;
}

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

function formatPackaging(item: InventoryItem) {
  const type = item.packaging_type || "package";
  const pcs = item.pcs_per_package ? `${item.pcs_per_package} pcs/${type}` : "—";
  return `${type} • ${pcs}`;
}

export default function SuppliesInventoryClient() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [branchCode, setBranchCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [globalItems, setGlobalItems] = useState<GlobalItem[]>([]);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalLoadError, setGlobalLoadError] = useState<string | null>(null);

  const [transferItemName, setTransferItemName] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferNotice, setTransferNotice] = useState<Notice | null>(null);

  const [dispenseQty, setDispenseQty] = useState<Record<string, string>>({});
  const [dispenseBusy, setDispenseBusy] = useState<Record<string, boolean>>({});
  const [dispenseErrors, setDispenseErrors] = useState<Record<string, string | null>>({});
  const [inventoryNotice, setInventoryNotice] = useState<Notice | null>(null);

  const matchedGlobalItem = useMemo(() => {
    const needle = normalizeName(transferItemName);
    if (!needle) return null;
    return globalItems.find((it) => normalizeName(it.item_name) === needle) || null;
  }, [globalItems, transferItemName]);

  async function loadInventory() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/staff/supplies/inventory", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load supplies inventory.");

      setItems(Array.isArray(json?.items) ? json.items : []);
      setBranchCode(String(json?.branch_code || ""));
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load supplies inventory.");
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalInventory() {
    setGlobalLoading(true);
    setGlobalLoadError(null);
    try {
      const res = await fetch("/api/staff/supplies/global/inventory", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load global supplies.");

      setGlobalItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setGlobalLoadError(e?.message || "Failed to load global supplies.");
    } finally {
      setGlobalLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
    loadGlobalInventory();
  }, []);

  const transferQtyNum = toPositiveInt(transferQty);
  const globalAvailable = matchedGlobalItem?.remaining_pcs_available ?? 0;
  const transferQtyTooHigh = transferQtyNum != null && transferQtyNum > globalAvailable;
  const transferReady = !!matchedGlobalItem && !!transferQtyNum && !transferring;

  async function onTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTransferNotice(null);

    if (!matchedGlobalItem) {
      setTransferNotice({
        type: "error",
        message: "Select a valid global item to transfer.",
      });
      return;
    }
    if (!transferQtyNum) {
      setTransferNotice({
        type: "error",
        message: "Enter a valid transfer quantity.",
      });
      return;
    }
    if (transferQtyNum > globalAvailable) {
      setTransferNotice({
        type: "error",
        message: "Quantity exceeds global available stock.",
      });
      return;
    }

    try {
      setTransferring(true);
      const res = await fetch("/api/staff/supplies/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: matchedGlobalItem.item_id,
          qty_pcs: transferQtyNum,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to transfer stock.");
      }

      setTransferNotice({
        type: "success",
        message: `Transferred ${transferQtyNum.toLocaleString()} pcs from Global.`,
      });
      setTransferQty("");
      await loadInventory();
      await loadGlobalInventory();
    } catch (e: any) {
      setTransferNotice({
        type: "error",
        message: e?.message || "Failed to transfer stock.",
      });
    } finally {
      setTransferring(false);
    }
  }

  function setQtyFor(itemId: string, value: string) {
    setDispenseQty((prev) => ({ ...prev, [itemId]: value }));
    setDispenseErrors((prev) => ({ ...prev, [itemId]: null }));
    setInventoryNotice(null);
  }

  async function dispense(item: InventoryItem) {
    const qty = toPositiveInt(dispenseQty[item.item_id] || "");
    if (!qty) {
      setDispenseErrors((prev) => ({ ...prev, [item.item_id]: "Enter a valid quantity." }));
      return;
    }

    const available = item.remaining_pcs_available ?? 0;
    if (qty > available) {
      setDispenseErrors((prev) => ({
        ...prev,
        [item.item_id]: "Quantity exceeds available stock.",
      }));
      return;
    }

    setDispenseBusy((prev) => ({ ...prev, [item.item_id]: true }));
    setDispenseErrors((prev) => ({ ...prev, [item.item_id]: null }));
    try {
      const res = await fetch("/api/staff/supplies/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.item_id, qty_pcs: qty }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to dispense stock.");

      setInventoryNotice({
        type: "success",
        message: `Dispensed ${qty.toLocaleString()} pcs.`,
      });
      setDispenseQty((prev) => ({ ...prev, [item.item_id]: "" }));
      await loadInventory();
    } catch (e: any) {
      setDispenseErrors((prev) => ({
        ...prev,
        [item.item_id]: e?.message || "Failed to dispense stock.",
      }));
    } finally {
      setDispenseBusy((prev) => ({ ...prev, [item.item_id]: false }));
    }
  }

  const datalistItems = useMemo(() => {
    return globalItems
      .filter((it) => (it.remaining_pcs_available ?? 0) > 0)
      .map((it) => it.item_name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [globalItems]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Supplies Inventory</h1>
          <p className="text-sm text-gray-600">
            Transfer from Global and dispense available supplies by pcs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {branchCode && (
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-600">
              Branch: {branchCode}
            </span>
          )}
          {loading && <span>Loading...</span>}
        </div>
      </header>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-sm">
          {loadError}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Transfer from Global</h2>
          <p className="text-sm text-gray-600">
            Select an item with available global stock, then transfer pcs into this branch.
          </p>
        </div>

        {globalLoadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {globalLoadError}
          </div>
        )}

        {transferNotice && (
          <div
            className={[
              "rounded-lg border px-4 py-2 text-sm",
              transferNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {transferNotice.message}
          </div>
        )}

        <form onSubmit={onTransferSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-gray-700">Item Name</span>
            <input
              list="supplies-item-options"
              value={transferItemName}
              onChange={(e) => {
                setTransferItemName(e.target.value);
                setTransferNotice(null);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g., Syringes 5ml"
              autoComplete="off"
              required
            />
            <datalist id="supplies-item-options">
              {datalistItems.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <span className="mt-1 block text-xs text-gray-500">
              {globalLoading
                ? "Loading global items..."
                : matchedGlobalItem
                  ? `${formatPackaging(matchedGlobalItem)} • Available: ${formatCount(
                      matchedGlobalItem.remaining_pcs_available,
                    )} pcs`
                  : "Only items with available global stock appear in the list."}
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Transfer Qty (pcs)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={transferQty}
              onChange={(e) => {
                setTransferQty(e.target.value);
                setTransferNotice(null);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g., 50"
              required
            />
            {transferQtyTooHigh && (
              <span className="mt-1 block text-xs text-amber-700">
                Quantity exceeds global available stock.
              </span>
            )}
          </label>

          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 md:col-span-2">
            Transfers consume from earliest expiry in Global (FEFO).
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!transferReady || transferQtyTooHigh}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {transferring ? "Transferring..." : "Transfer from Global"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory List</h2>
            <p className="text-sm text-gray-600">
              Available totals exclude expired stock. Dispense uses FEFO.
            </p>
          </div>
        </div>

        {inventoryNotice && (
          <div
            className={[
              "rounded-xl border px-4 py-2 text-sm shadow-sm",
              inventoryNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {inventoryNotice.message}
          </div>
        )}

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-xl border bg-white p-4 text-center text-gray-500">
              Loading inventory...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 text-center text-gray-500">
              No supplies found for this branch.
            </div>
          ) : (
            items.map((item) => {
              const available = item.remaining_pcs_available ?? 0;
              const qtyValue = dispenseQty[item.item_id] || "";
              const qtyNum = toPositiveInt(qtyValue);
              const qtyTooHigh = qtyNum != null && qtyNum > available;
              const hasExpired =
                (item.remaining_pcs_all ?? 0) > (item.remaining_pcs_available ?? 0);

              return (
                <article
                  key={item.item_id}
                  className="rounded-2xl border bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Item</p>
                      <p className="text-lg font-semibold text-gray-900">{item.item_name}</p>
                      <p className="text-xs text-gray-500">{formatPackaging(item)}</p>
                    </div>
                    {hasExpired && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                        Has expired stock
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 text-sm text-gray-700">
                    <div>
                      <span className="font-medium text-gray-900">Available Remaining:</span>{" "}
                      {formatCount(item.remaining_pcs_available)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Next Expiry:</span>{" "}
                      {item.nearest_expiry_date || "—"}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900">Next Expiries:</span>
                      <div className="mt-1 space-y-1 text-xs text-gray-600">
                        {item.next_expiries && item.next_expiries.length > 0 ? (
                          item.next_expiries.map((exp) => (
                            <div key={`${item.item_id}-${exp.expiry_date}`}>
                              <span className="font-mono">{exp.expiry_date}</span> —{" "}
                              {formatCount(exp.remaining_pcs)} pcs
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Dispense (pcs)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={qtyValue}
                        onChange={(e) => setQtyFor(item.item_id, e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => dispense(item)}
                        disabled={!qtyNum || qtyTooHigh || !!dispenseBusy[item.item_id]}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {dispenseBusy[item.item_id] ? "Dispensing..." : "Dispense"}
                      </button>
                    </div>
                    {qtyTooHigh && (
                      <div className="text-xs text-amber-700">
                        Quantity exceeds available stock.
                      </div>
                    )}
                    {dispenseErrors[item.item_id] && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                        {dispenseErrors[item.item_id]}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="hidden overflow-auto rounded-xl border bg-white shadow-sm md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-medium px-3 py-2">Item</th>
                <th className="text-left font-medium px-3 py-2">Packaging</th>
                <th className="text-left font-medium px-3 py-2">Available Remaining</th>
                <th className="text-left font-medium px-3 py-2">Next Expiry</th>
                <th className="text-left font-medium px-3 py-2">Next Expiries</th>
                <th className="text-left font-medium px-3 py-2">Dispense</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                    No supplies found for this branch.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const available = item.remaining_pcs_available ?? 0;
                  const qtyValue = dispenseQty[item.item_id] || "";
                  const qtyNum = toPositiveInt(qtyValue);
                  const qtyTooHigh = qtyNum != null && qtyNum > available;
                  const hasExpired =
                    (item.remaining_pcs_all ?? 0) > (item.remaining_pcs_available ?? 0);

                  return (
                    <tr key={item.item_id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{item.item_name}</div>
                        {hasExpired && (
                          <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Has expired stock
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{formatPackaging(item)}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        {formatCount(item.remaining_pcs_available)}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {item.nearest_expiry_date || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {item.next_expiries && item.next_expiries.length > 0 ? (
                          <div className="space-y-1 text-xs text-gray-600">
                            {item.next_expiries.map((exp) => (
                              <div key={`${item.item_id}-${exp.expiry_date}`}>
                                <span className="font-mono">{exp.expiry_date}</span> —{" "}
                                {formatCount(exp.remaining_pcs)} pcs
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={qtyValue}
                              onChange={(e) => setQtyFor(item.item_id, e.target.value)}
                              className="w-28 rounded-md border px-2 py-1"
                              placeholder="pcs"
                            />
                            <button
                              type="button"
                              onClick={() => dispense(item)}
                              disabled={!qtyNum || qtyTooHigh || !!dispenseBusy[item.item_id]}
                              className="rounded-md border px-3 py-1 text-sm shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {dispenseBusy[item.item_id] ? "Dispensing..." : "Dispense"}
                            </button>
                          </div>
                          {qtyTooHigh && (
                            <div className="text-xs text-amber-700">
                              Quantity exceeds available stock.
                            </div>
                          )}
                          {dispenseErrors[item.item_id] && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                              {dispenseErrors[item.item_id]}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
