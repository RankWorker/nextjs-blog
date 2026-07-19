import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const slugSchema = nonEmptyString.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: "Use a lowercase URL-safe slug containing letters, numbers, and hyphens.",
});

const imageSchema = z.object({
  title: nonEmptyString.nullish().transform((value) => value ?? null),
  caption: nonEmptyString.nullish().transform((value) => value ?? null),
  url: nonEmptyString,
});

export const rankWorkerArticleSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: nonEmptyString,
  slug: slugSchema,
  date: z.coerce.date(),
  cover: imageSchema.nullish().transform((value) => value ?? null),
  images: z
    .array(imageSchema)
    .nullish()
    .transform((value) => value ?? []),
  description: nonEmptyString.nullish().transform((value) => value ?? null),
  excerpt: nonEmptyString.nullish().transform((value) => value ?? null),
  keywords: z
    .array(nonEmptyString)
    .nullish()
    .transform((value) => value ?? []),
  tags: z
    .array(nonEmptyString)
    .nullish()
    .transform((value) => value ?? []),
  markdownBody: nonEmptyString,
  generatedAt: z.coerce
    .date()
    .nullish()
    .transform((value) => value ?? null),
  updatedAt: z.coerce
    .date()
    .nullish()
    .transform((value) => value ?? null),
});

export const rankWorkerPageSchema = z.object({
  content: z.array(rankWorkerArticleSchema),
  page: z.object({
    number: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    first: z.boolean(),
    last: z.boolean(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
});

export const localFrontmatterSchema = z.object({
  title: nonEmptyString,
  description: nonEmptyString,
  excerpt: nonEmptyString,
  slug: slugSchema,
  date: z.coerce.date(),
  cover: nonEmptyString.optional(),
  coverAlt: nonEmptyString.optional(),
  keywords: z.array(nonEmptyString).default([]),
  tags: z.array(nonEmptyString).default([]),
});

export const webhookArticleSchema = rankWorkerArticleSchema.extend({
  htmlBody: z.string().optional(),
});

export type RankWorkerArticleInput = z.infer<typeof rankWorkerArticleSchema>;
export type LocalFrontmatter = z.infer<typeof localFrontmatterSchema>;
