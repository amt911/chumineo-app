import { InventoryProgress } from '@/components/inventory/inventory-progress';

export default function InventoryPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Mi inventario</h1>
      <InventoryProgress />
    </main>
  );
}
