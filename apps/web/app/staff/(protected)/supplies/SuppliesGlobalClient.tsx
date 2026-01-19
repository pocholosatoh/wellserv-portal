"use client";

import { useEffect, useMemo, useState } from "react";

const PACKAGING_TYPES = ["box", "bundle", "pack", "bag", "bottle"] as const;
type PackagingType = (typeof PACKAGING_TYPES)[number];

type NextExpiry = {
  expiry_date: string;
  remaining_pcs: number;
};

type GlobalItem = {
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

function formatPackaging(item: GlobalItem) {
  const type = item.packaging_type || "package";
  const pcs = item.pcs_per_package ? `${item.pcs_per_package} pcs/${type}` : "—";
  return `${type} • ${pcs}`;
}

export default function SuppliesGlobalClient() {
  const [items, setItems] = useState<GlobalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [itemName, setItemName] = useState("");
  const [packagingType, setPackagingType] = useState<PackagingType>("box");
  const [pcsPerPackage, setPcsPerPackage] = useState("");
  const [packagingCount, setPackagingCount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [receiveNotice, setReceiveNotice] = useState<Notice | null>(null);

  const matchedItem = useMemo(() => {
    const needle = normalizeName(itemName);
    if (!needle) return null;
    return items.find((it) => normalizeName(it.item_name) === needle) || null;
  }, [items, itemName]);

  useEffect(() => {
    if (!matchedItem) return;
    if (matchedItem.packaging_type) {
      setPackagingType(matchedItem.packaging_type);
    }
    if (typeof matchedItem.pcs_per_package === "number") {
      setPcsPerPackage(String(matchedItem.pcs_per_package));
    }
  }, [matchedItem]);

  async function loadGlobalInventory() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/staff/supplies/global/inventory", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load global supplies.");

      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setLoadError(e?.message || "Failed to load global supplies.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGlobalInventory();
  }, []);

  const pcsPerPackageNum = toPositiveInt(pcsPerPackage);
  const packagingCountNum = toPositiveInt(packagingCount);
  const addedPcs =
    pcsPerPackageNum && packagingCountNum ? pcsPerPackageNum * packagingCountNum : null;
  const expiryValid = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(expiryDate);
  const receiveReady =
    itemName.trim() &&
    packagingType &&
    pcsPerPackageNum &&
    packagingCountNum &&
    expiryValid &&
    !receiving;

  async function onReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReceiveNotice(null);
    if (!receiveReady) {
      setReceiveNotice({
        type: "error",
        message: "Please complete all required fields with valid values.",
      });
      return;
    }

    try {
      setReceiving(true);
      const res = await fetch("/api/staff/supplies/global/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: itemName.trim(),
          packaging_type: packagingType,
          pcs_per_package: pcsPerPackageNum,
          packaging_count: packagingCountNum,
          expiry_date: expiryDate,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to receive global stock.");
      }

      setReceiveNotice({
        type: "success",
        message: `Added ${addedPcs?.toLocaleString()} pcs to Global.`,
      });
      setPackagingCount("");
      await loadGlobalInventory();
    } catch (e: any) {
      setReceiveNotice({
        type: "error",
        message: e?.message || "Failed to receive global stock.",
      });
    } finally {
      setReceiving(false);
    }
  }

  const datalistItems = useMemo(() => {
    return items
      .map((it) => it.item_name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [items]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Global Supplies</h1>
          <p className="text-sm text-gray-600">
            Add new global stock and review available batches across all items.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
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
          <h2 className="text-base font-semibold text-gray-900">Add Global Stock</h2>
          <p className="text-sm text-gray-600">
            Create or select an item, then log received packages into Global stock.
          </p>
        </div>

        {receiveNotice && (
          <div
            className={[
              "rounded-lg border px-4 py-2 text-sm",
              receiveNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {receiveNotice.message}
          </div>
        )}

        <form onSubmit={onReceiveSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-gray-700">Item Name</span>
            <input
              list="supplies-global-item-options"
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value);
                setReceiveNotice(null);
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g., Syringes 5ml"
              autoComplete="off"
              required
            />
            <datalist id="supplies-global-item-options">
              {datalistItems.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {matchedItem && (
              <span className="mt-1 block text-xs text-gray-500">
                Existing item selected. Packaging defaults applied.
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Packaging Type</span>
            <select
              value={packagingType}
              onChange={(e) => setPackagingType(e.target.value as PackagingType)}
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
              required
            >
              {PACKAGING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">PCS per Package</span>
            <input
              type="number"
              min={1}
              step={1}
              value={pcsPerPackage}
              onChange={(e) => setPcsPerPackage(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g., 100"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Packaging Count</span>
            <input
              type="number"
              min={1}
              step={1}
              value={packagingCount}
              onChange={(e) => setPackagingCount(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="e.g., 3"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Expiry Date</span>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>

          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 md:col-span-2">
            Added PCS: <span className="font-semibold">{addedPcs ? addedPcs.toLocaleString() : "—"}</span>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!receiveReady}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {receiving ? "Receiving..." : "Add to Global"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Global Inventory</h2>
            <p className="text-sm text-gray-600">
              Available totals exclude expired stock. FEFO applies for transfers.
            </p>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="rounded-xl border bg-white p-4 text-center text-gray-500">
              Loading inventory...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 text-center text-gray-500">
              No global supplies found.
            </div>
          ) : (
            items.map((item) => {
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                    No global supplies found.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
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
