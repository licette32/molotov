-- token_effective_owner: display owner for browse/profiles/work page.
--
-- While a token is in active escrow its on-chain owner is the marketplace
-- contract. The view returns the SELLER as effective_owner for unsold editions
-- in an active listing so the UI shows the right human owner.
--
-- Range logic (see indexer-spec.md §3.9):
--   unsold editions = [token_id + editions_sold, token_id + editions_total)
-- Each Sold event increments editions_sold, sliding the left bound rightward.
-- A token whose index is left of the bound has already been bought (owner = buyer).
CREATE VIEW token_effective_owner AS
SELECT
  t.*,
  COALESCE(
    (
      SELECT l.seller
        FROM listings l
       WHERE l.status = 'active'
         AND t.token_id >= l.token_id + l.editions_sold
         AND t.token_id <  l.token_id + l.editions_total
       LIMIT 1
    ),
    t.owner
  ) AS effective_owner,
  (
    SELECT l.listing_id
      FROM listings l
     WHERE l.status = 'active'
       AND t.token_id >= l.token_id + l.editions_sold
       AND t.token_id <  l.token_id + l.editions_total
     LIMIT 1
  ) AS active_listing_id
FROM tokens t;
