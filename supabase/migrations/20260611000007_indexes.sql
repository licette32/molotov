-- Hot read paths for browse, profiles, and activity feed.
CREATE INDEX idx_tokens_artist        ON tokens (artist);
CREATE INDEX idx_tokens_owner         ON tokens (owner) WHERE NOT burned;
CREATE INDEX idx_listings_token       ON listings (token_id);
CREATE INDEX idx_listings_active      ON listings (status) WHERE status = 'active';
CREATE INDEX idx_listings_seller      ON listings (seller);
CREATE INDEX idx_sales_listing        ON sales (listing_id);
CREATE INDEX idx_sales_token          ON sales (token_id);
CREATE INDEX idx_sales_buyer          ON sales (buyer);
CREATE INDEX idx_sales_seller         ON sales (seller);
CREATE INDEX idx_token_transfers_token ON token_transfers (token_id);
-- OE range scan used by token_effective_owner view
CREATE INDEX idx_listings_oe_range    ON listings (token_id, editions_sold, editions_total)
  WHERE status = 'active';
