CREATE TABLE observations (
  product_id TEXT NOT NULL,
  day TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'unavailable', 'error')),
  price_ore INTEGER,
  protein_grams REAL NOT NULL CHECK (protein_grams > 0),
  CHECK ((status = 'ok' AND price_ore IS NOT NULL AND price_ore > 0)
    OR (status IN ('unavailable', 'error') AND price_ore IS NULL)),
  PRIMARY KEY (product_id, day)
) WITHOUT ROWID;
