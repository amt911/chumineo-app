import { CollectionBrowser } from '@/components/collections/collection-browser';

export default function CollectionsPage() {
  return (
    <main className="container mx-auto px-6 py-8">
      <h1 className="mb-6 font-heading text-2xl font-bold">Collections</h1>
      <CollectionBrowser />
    </main>
  );
}
