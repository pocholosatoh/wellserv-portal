import SuppliesInventoryClient from "./SuppliesInventoryClient";

export const dynamic = "force-dynamic";

export default function StaffSuppliesPage() {
  return (
    <main className="space-y-6">
      <SuppliesInventoryClient />
    </main>
  );
}
