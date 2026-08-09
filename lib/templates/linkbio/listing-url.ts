/**
 * One place that builds the homepage URL, because three controls write to it —
 * the chips, the search field and the pager — and each has to preserve what the
 * other two set. Paging that dropped the filter, or a chip that dropped the
 * search, is the bug this exists to prevent.
 */
export type ListingState = {
  categories: string[];
  query?: string;
  sort?: string;
  page?: number;
};

export function listingHref({ categories, query, sort, page }: ListingState): string {
  const params = new URLSearchParams();
  if (categories.length > 0) params.set("cat", categories.join(","));
  if (query) params.set("q", query);
  // "newest" is the default; spelling it out would put a parameter in every URL
  // that changes nothing.
  if (sort && sort !== "newest") params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * The URL with one category flipped on or off.
 *
 * Always returns to page 1: page 4 of the old filter is rarely a page at all
 * under the new one, and landing on an empty page reads as "no products".
 */
export function toggleCategoryHref(state: ListingState, slug: string): string {
  const on = state.categories.includes(slug);
  return listingHref({
    ...state,
    categories: on
      ? state.categories.filter((c) => c !== slug)
      : [...state.categories, slug],
    page: 1,
  });
}
