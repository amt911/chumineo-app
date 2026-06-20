import type { CollectionResponseDto } from '@sobrebox/shared';

export function CollectionList({ collections }: { collections: CollectionResponseDto[] }) {
  if (collections.length === 0) {
    return <p>No collections yet.</p>;
  }
  return (
    <ul>
      {collections.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  );
}
