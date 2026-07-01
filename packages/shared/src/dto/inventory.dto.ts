import { z } from 'zod';
import { Condition } from '../enums/condition';
import { Rarity } from '../enums/rarity';

const itemRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  imageUrl: z.string().nullable(),
});

const collectionRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
});

export const addInventoryItemSchema = z.object({
  collectionItemId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  condition: z.nativeEnum(Condition).optional(),
});
export type AddInventoryItemDto = z.infer<typeof addInventoryItemSchema>;

export const updateInventoryItemSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    condition: z.nativeEnum(Condition).nullable().optional(),
  })
  .refine((v) => v.quantity !== undefined || v.condition !== undefined, {
    message: 'At least one field is required',
  });
export type UpdateInventoryItemDto = z.infer<typeof updateInventoryItemSchema>;

export const inventoryItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  condition: z.nativeEnum(Condition).nullable(),
  item: itemRefSchema,
  collection: collectionRefSchema,
});
export type InventoryItemDto = z.infer<typeof inventoryItemSchema>;

export const collectionProgressSummarySchema = z.object({
  collection: collectionRefSchema,
  owned: z.number().int(),
  total: z.number().int(),
  percent: z.number().int(),
});
export type CollectionProgressSummaryDto = z.infer<
  typeof collectionProgressSummarySchema
>;

export const collectionProgressItemSchema = z.object({
  collectionItemId: z.string(),
  name: z.string(),
  rarity: z.nativeEnum(Rarity),
  ownedQuantity: z.number().int(),
  // Row ids so the UI can toggle state off (delete). Null when absent.
  inventoryId: z.string().nullable(),
  wishlistId: z.string().nullable(),
});

export const collectionProgressSchema = collectionProgressSummarySchema.extend({
  items: z.array(collectionProgressItemSchema),
});
export type CollectionProgressDto = z.infer<typeof collectionProgressSchema>;
