/**
 * Local re-exports so the prerequisites package depends only on teaching-projection hash helpers.
 */

import { projectionDigest, projectionSha256 } from '../hash';
import { projectionIdFromHash } from '../identity';

export { projectionDigest, projectionSha256 };

/** Publication ids use the same proj- prefix family as Teaching Projection. */
export function projectionIdFromHashCompat(hash: string): string {
  return projectionIdFromHash(hash);
}
