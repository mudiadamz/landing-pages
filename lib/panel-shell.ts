/**
 * Which panel shell a person gets (components/account-shell.tsx vs the sidebar).
 *
 * Pure and on its own so it can be tested without a request — the rule matters
 * more than it looks: getting it wrong in one direction shows a buyer an admin
 * console, and in the other it takes menus away from someone who had them
 * yesterday, with nothing on screen to explain why.
 *
 * Only the second failure is serious, so the rule is written as a list of
 * things the person CANNOT do. Any single capability keeps the sidebar.
 */

export type PanelCapabilities = {
  /** Platform operator (`lp_profiles.is_platform`). */
  isPlatform: boolean;
  /** Role in the business that owns the storefront being edited, or null. */
  businessRole: string | null;
  /** May create/sell products HERE — i.e. belongs to the business that owns it. */
  canSell: boolean;
  /** Admin features reachable, from either permission matrix. */
  featureCount: number;
};

/**
 * True when this person only ever buys: the account shell (four tabs) fits them
 * and the twenty-six-slot rail does not.
 */
export function isCustomerOnly(c: PanelCapabilities): boolean {
  return !c.isPlatform && !c.businessRole && !c.canSell && c.featureCount === 0;
}
