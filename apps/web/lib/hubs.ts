// lib/hubs.ts
export const BRANCHES = [
  "San Isidro",
  "San Leonardo",
  // add more when needed
] as const;

export type Branch = (typeof BRANCHES)[number];

export type HubInfo = {
  name: string; // must match followups.return_branch and consultations.branch
  label: string; // what we show to users
  tel?: string; // click-to-call
  mapsUrl?: string; // Google Maps URL
};

export const HUBS: HubInfo[] = [
  {
    name: "San Isidro",
    label: "San Isidro Hub",
    tel: "09939854927",
    mapsUrl: "https://maps.app.goo.gl/vo9kyUrNH2z2suv59",
  },
  {
    name: "San Leonardo",
    label: "San Leonardo Hub",
    tel: "09942760253",
    mapsUrl: "https://maps.app.goo.gl/X9Zqa2pvE6H3t3Lf7",
  },
  // add more hubs here as you expand
];

export const HUB_BY_NAME: Record<string, HubInfo> = Object.fromEntries(
  HUBS.map((h) => [h.name, h]),
);
