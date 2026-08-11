/**
 * Editorial page shapes.
 *
 * A plain module, not the actions file: that one is "use server", where every
 * export becomes a server action and only async functions are allowed (I5).
 */
export type EditorialPage = {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  content: string;
  published: boolean;
  sort_order: number;
};

export type EditorialPageSummary = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  /** Present on the panel listing; the public one only ever returns published. */
  published?: boolean;
};
