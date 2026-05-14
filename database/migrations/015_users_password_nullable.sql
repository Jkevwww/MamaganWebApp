-- Allow OAuth-only accounts when legacy `password` column exists and was NOT NULL.
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;
