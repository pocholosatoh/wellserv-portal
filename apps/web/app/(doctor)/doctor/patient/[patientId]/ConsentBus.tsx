"use client";

import { useEffect, useState, useCallback } from "react";
import ConsentModal from "./ConsentModal";

type Payload = {
  consultationId: string;
  encounterId: string;
  patientId: string;
};

export default function ConsentBus({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<Payload | null>(null);

  const onOpen = useCallback((e: CustomEvent<Payload>) => {
    setPay(e.detail);
    setOpen(true);
  }, []);

  useEffect(() => {
    const handler = onOpen as EventListener;
    window.addEventListener("wellserv:openConsent", handler);
    return () => window.removeEventListener("wellserv:openConsent", handler);
  }, [onOpen]);

  if (!open || !pay) return null;

  return (
    <ConsentModal
      isOpen={open}
      onClose={() => setOpen(false)}
      consultationId={pay.consultationId}
      encounterId={pay.encounterId}
      patientId={pay.patientId}
      templateSlug="yakap-consent"
      templateVersion={1}
      onSaved={() => setOpen(false)}
    />
  );
}
