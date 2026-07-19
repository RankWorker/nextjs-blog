import type { BlogPage } from "./types.js";

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): BlogPage<T> | null {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  if (page > totalPages) {
    return null;
  }

  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems: items.length,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}

export function paginationItems(
  currentPage: number,
  totalPages: number,
  windowSize: number,
): readonly (number | "ellipsis")[] {
  if (totalPages <= 1) return [1];

  const radius = Math.max(1, Math.floor(windowSize / 2));
  const included = new Set([1, totalPages]);
  for (
    let page = Math.max(1, currentPage - radius);
    page <= Math.min(totalPages, currentPage + radius);
    page += 1
  ) {
    included.add(page);
  }

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const page of [...included].sort((a, b) => a - b)) {
    if (previous > 0 && page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}
