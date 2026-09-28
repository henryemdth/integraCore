export type PageRangeItem = number | "ellipsis";

function range(start: number, end: number): number[] {
  const length = Math.max(0, end - start + 1);
  return Array.from({ length }, (_, i) => start + i);
}

/**
 * Builds the numbered page list for a pagination bar: page 1 and totalPages are
 * always included (one-click jump to either end), the current page gets
 * `siblingCount` neighbours on each side, and gaps collapse into "ellipsis"
 * markers. When everything fits, all pages are shown.
 *
 * Example (siblingCount 1, current 5 of 20): [1, "ellipsis", 4, 5, 6, "ellipsis", 20]
 */
export function generatePageRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PageRangeItem[] {
  const lastPage = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), lastPage);

  // first + last + current + siblings on both sides + two ellipsis slots
  const totalSpots = siblingCount * 2 + 5;
  if (lastPage <= totalSpots) {
    return range(1, lastPage);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, lastPage);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < lastPage - 1;

  if (!showLeftDots && showRightDots) {
    return [...range(1, 3 + 2 * siblingCount), "ellipsis", lastPage];
  }

  if (showLeftDots && !showRightDots) {
    return [1, "ellipsis", ...range(lastPage - (3 + 2 * siblingCount) + 1, lastPage)];
  }

  return [1, "ellipsis", ...range(leftSibling, rightSibling), "ellipsis", lastPage];
}
