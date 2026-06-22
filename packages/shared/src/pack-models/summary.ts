import { CollectionCategory } from '../enums/collection-category';
import { validatePackModel } from './registry';
import type { TcgPackModel } from './tcg.schema';
import type { BlindBoxPackModel } from './blind-box.schema';
import type { FigurePackModel } from './figure.schema';

export function packSummary(
  category: CollectionCategory,
  packModel: unknown,
): string {
  const result = validatePackModel(category, packModel);
  if (!result.success) return 'Unknown pack';
  const data = result.data;

  switch (category) {
    case CollectionCategory.TCG: {
      const total = (data as TcgPackModel).slots.reduce(
        (n, s) => n + s.count,
        0,
      );
      return `${total} cards`;
    }
    case CollectionCategory.BLIND_BOX:
      return `case of ${(data as BlindBoxPackModel).caseSize}`;
    case CollectionCategory.FIGURE: {
      const n = (data as FigurePackModel).items.length;
      return `${n} figure${n === 1 ? '' : 's'}`;
    }
    default:
      return 'Unknown pack';
  }
}
