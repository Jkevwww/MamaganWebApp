-- Migration 023: Store durable facility image data URLs.

ALTER TABLE facilities
  MODIFY image_url LONGTEXT NULL;
