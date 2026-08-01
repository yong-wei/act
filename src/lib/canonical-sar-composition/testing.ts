/**
 * Test-only SAR composition capability mints (#1114).
 *
 * NOT re-exported from the production public index. Production binding sets
 * are emitted only by the KAQ and resource projectors after they verify exact
 * instances from their respective governance producers.
 */

export { mintVerifiedSarBindingSetForTests } from './binding-capability';
