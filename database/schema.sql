-- Nationwide facility database schema for Cloudflare D1 / SQLite
-- Schema version: 1
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prefectures (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS municipalities (
  code TEXT PRIMARY KEY,
  prefecture_code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  municipality_type TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prefecture_code) REFERENCES prefectures(code)
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_kana TEXT,
  facility_type TEXT NOT NULL,
  prefecture_code TEXT NOT NULL,
  municipality_code TEXT NOT NULL,
  postal_code TEXT,
  address TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('open','closed','temporarily_closed','planned','unknown')),
  opening_date TEXT,
  closing_date TEXT,
  official_url TEXT,
  confidence TEXT NOT NULL DEFAULT 'unverified'
    CHECK (confidence IN ('official','confirmed','high','medium','low','unverified')),
  last_verified_at TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prefecture_code) REFERENCES prefectures(code),
  FOREIGN KEY (municipality_code) REFERENCES municipalities(code)
);

CREATE INDEX IF NOT EXISTS idx_facilities_municipality_type_status
  ON facilities(municipality_code, facility_type, status);

CREATE INDEX IF NOT EXISTS idx_facilities_prefecture_type
  ON facilities(prefecture_code, facility_type);

CREATE INDEX IF NOT EXISTS idx_facilities_opening_date
  ON facilities(opening_date DESC);

CREATE INDEX IF NOT EXISTS idx_facilities_updated_at
  ON facilities(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_facilities_lat_lon
  ON facilities(latitude, longitude);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  facility_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS facility_categories (
  facility_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  confidence REAL,
  source TEXT,
  PRIMARY KEY (facility_id, category_id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_facility_categories_category
  ON facility_categories(category_id, facility_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS facility_tags (
  facility_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  PRIMARY KEY (facility_id, tag_id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  license TEXT,
  trust_level TEXT NOT NULL DEFAULT 'unknown',
  update_frequency TEXT,
  retrieved_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facility_sources (
  facility_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_entity_id TEXT,
  source_url TEXT,
  raw_name TEXT,
  raw_address TEXT,
  observed_at TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (facility_id, source_id, source_entity_id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_facility_sources_source_entity
  ON facility_sources(source_id, source_entity_id);

CREATE TABLE IF NOT EXISTS facility_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  source_id TEXT,
  changed_at TEXT NOT NULL,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX IF NOT EXISTS idx_facility_changes_facility_date
  ON facility_changes(facility_id, changed_at DESC);

-- D1 supports SQLite FTS5. The trigram tokenizer is useful for arbitrary
-- substring searches on Japanese names/addresses without leading-% LIKE scans.
CREATE VIRTUAL TABLE IF NOT EXISTS facilities_fts USING fts5(
  facility_id UNINDEXED,
  name,
  address,
  search_text,
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS facilities_ai AFTER INSERT ON facilities BEGIN
  INSERT INTO facilities_fts(facility_id, name, address, search_text)
  VALUES (new.id, new.name, new.address, new.search_text);
END;

CREATE TRIGGER IF NOT EXISTS facilities_ad AFTER DELETE ON facilities BEGIN
  DELETE FROM facilities_fts WHERE facility_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS facilities_au AFTER UPDATE ON facilities BEGIN
  DELETE FROM facilities_fts WHERE facility_id = old.id;
  INSERT INTO facilities_fts(facility_id, name, address, search_text)
  VALUES (new.id, new.name, new.address, new.search_text);
END;
