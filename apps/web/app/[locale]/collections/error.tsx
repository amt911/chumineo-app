'use client';

export default function CollectionsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main>
      <h1>Collections</h1>
      <p>We couldn’t load the collections right now.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
