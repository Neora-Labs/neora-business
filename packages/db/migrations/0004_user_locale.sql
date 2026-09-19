ALTER TABLE users ADD COLUMN preferred_locale text;
ALTER TABLE users ADD CONSTRAINT users_preferred_locale_check CHECK (preferred_locale IS NULL OR preferred_locale IN ('es', 'en'));
