-- Needs/offers support: case type + human-friendly sequential case number.
-- type: 'need' (someone asks for help) or 'offer' (someone offers help).
-- case_num: sequential number shown to reporters (e.g. "Caso #1042").

ALTER TABLE cards ADD COLUMN type TEXT NOT NULL DEFAULT 'need' CHECK (type IN ('need', 'offer'));
ALTER TABLE cards ADD COLUMN case_num INTEGER;

-- Backfill existing rows in creation order.
UPDATE cards
SET case_num = t.rn
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn FROM cards) AS t
WHERE cards.id = t.id AND cards.case_num IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_case_num ON cards(case_num);
CREATE INDEX IF NOT EXISTS idx_cards_type_status ON cards(type, status);
