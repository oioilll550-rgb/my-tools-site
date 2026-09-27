-- Add normalized Gregorian permit/notification date to source records.
ALTER TABLE facility_sources ADD COLUMN permit_date TEXT;

CREATE INDEX IF NOT EXISTS idx_facility_sources_permit_date
  ON facility_sources(permit_date DESC, facility_id);
