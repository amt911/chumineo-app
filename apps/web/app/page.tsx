import { redirect } from 'next/navigation';

export default function Home() {
  // Phase 0 has no landing/dashboard yet (later epic) — send the root to the catalog.
  redirect('/collections');
}
