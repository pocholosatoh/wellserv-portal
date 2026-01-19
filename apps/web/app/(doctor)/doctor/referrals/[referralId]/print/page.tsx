import { headers } from "next/headers";
import ReferralFormView, { ReferralFormData } from "@/components/ReferralFormView";
import PrintToolbar from "./PrintToolbar";
import "./print.css";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function getReferral(referralId: string) {
  const base = await getBaseUrl();
  const h = await headers();
  const res = await fetch(`${base}/api/referrals/${referralId}`, {
    cache: "no-store",
    headers: new Headers(h),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load referral (${res.status}) ${text}`);
  }
  return res.json();
}

export default async function ReferralPrintPage({
  params,
}: {
  params: Promise<{ referralId: string }>;
}) {
  const { referralId } = await params;
  const data = await getReferral(referralId);
  const referral = data?.referral as ReferralFormData;

  return (
    <div className="print-page-root bg-slate-100 min-h-screen py-6 print:bg-white print:min-h-0 print:py-0">
      <div className="referral-print-page">
        <PrintToolbar referralCode={referral?.referral?.referral_code} />
        <ReferralFormView data={referral} />
      </div>
    </div>
  );
}
