'use client';
import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Never re-subscribes: we only need the server-vs-client distinction once.
const emptySubscribe = (): (() => void) => () => {};

export function ThemeToggle() {
  // false on the server and the first client render, true after hydration — so
  // we render a placeholder until mounted and avoid an SSR/client mismatch.
  // useSyncExternalStore gives this without a setState-in-effect mount gate.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  // Decide off resolvedTheme: with defaultTheme="system", `theme` is "system"
  // until the user picks one, so toggling off `theme` needs two clicks to flip.
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <div className="size-8" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* Show the CURRENT theme: sun in light, moon in dark. */}
      {isDark ? <Moon /> : <Sun />}
    </Button>
  );
}
