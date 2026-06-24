import { WishlistList } from '@/components/wishlist/wishlist-list';

export default function WishlistPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Mi wishlist</h1>
      <WishlistList />
    </main>
  );
}
