import { CollectionList } from '@/components/collections/collection-list';
import { fetchCollections } from '@/lib/api';

export default async function CollectionsPage() {
  const collections = await fetchCollections();
  return (
    <main>
      <h1>Collections</h1>
      <CollectionList collections={collections} />
    </main>
  );
}
