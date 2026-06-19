import type { CollectionResponseDto } from '@sobrebox/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function fetchCollections(): Promise<CollectionResponseDto[]> {
  const res = await fetch(`${API_URL}/collections`);
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
  return res.json();
}
