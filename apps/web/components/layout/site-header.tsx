'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { logoutUser } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const router = useRouter();

  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // ignore logout errors — clear session regardless
    }
    clear();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-full items-center justify-between px-6">
        <Link
          href="/"
          className="font-heading text-lg font-bold tracking-tight"
        >
          SobreBox
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user === null ? (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'ghost' }))}
              >
                Login
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: 'default' }))}
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/profile/${user.username}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                @{user.username}
              </Link>
              <Button variant="ghost" onClick={handleLogout}>
                Log out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
