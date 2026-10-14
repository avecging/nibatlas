-- RETIRED: this one-time tool originally targeted what is now live production.
-- Refuse every connection, even when old confirmation/snapshot instructions are followed.
DO $$ BEGIN
  RAISE EXCEPTION 'Legacy catalogue reset is retired; live data must be preserved';
END $$;
