import type { CSSProperties } from 'react';
import { Rarity } from '@sobrebox/shared';
import { cn } from '@/lib/utils';

const LABEL: Record<Rarity, string> = {
  [Rarity.COMMON]: 'Common',
  [Rarity.UNCOMMON]: 'Uncommon',
  [Rarity.RARE]: 'Rare',
  [Rarity.ULTRA_RARE]: 'Ultra Rare',
  [Rarity.SECRET]: 'Secret',
  [Rarity.LIMITED]: 'Limited',
};

const TOKEN: Record<Rarity, string> = {
  [Rarity.COMMON]: '--rarity-common',
  [Rarity.UNCOMMON]: '--rarity-uncommon',
  [Rarity.RARE]: '--rarity-rare',
  [Rarity.ULTRA_RARE]: '--rarity-ultra',
  [Rarity.SECRET]: '--rarity-secret',
  [Rarity.LIMITED]: '--rarity-limited',
};

export function RarityBadge({
  rarity,
  className,
}: {
  rarity: Rarity;
  className?: string;
}) {
  const color = `var(${TOKEN[rarity]})`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        className,
      )}
      style={{ color, borderColor: color } as CSSProperties}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {LABEL[rarity]}
    </span>
  );
}
