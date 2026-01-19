"use client";

export default function PrintToolbar({ referralCode }: { referralCode?: string | null }) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-gray-600">
        {referralCode ? `Referral Code: ${referralCode}` : "Referral"}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Print
        </button>
      </div>
    </div>
  );
}
