'use client';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { logoutUser } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { LocaleSwitcher } from './locale-switcher';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const t = useTranslations('Nav');
  const status = useAuthStore((s) => s.status);
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
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-heading text-lg font-bold tracking-tight"
          >
            SobreBox
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/collections" className="hover:text-foreground">
              {t('collections')}
            </Link>
            {status === 'authenticated' && (
              <>
                <Link href="/inventory" className="hover:text-foreground">
                  {t('inventory')}
                </Link>
                <Link href="/wishlist" className="hover:text-foreground">
                  {t('wishlist')}
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
          {/* Branch on resolved status only — during `loading` render neither
              cluster so we don't flash the logged-out state before the
              AuthProvider rehydrates the session. */}
          {status === 'authenticated' && user ? (
            <>
              <Link
                href={`/profile/${user.username}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                @{user.username}
              </Link>
              <Button variant="ghost" onClick={handleLogout}>
                {t('logout')}
              </Button>
            </>
          ) : status === 'unauthenticated' ? (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'ghost' }))}
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: 'default' }))}
              >
                {t('register')}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
