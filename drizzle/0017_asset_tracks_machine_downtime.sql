ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "tracks_machine_downtime" boolean NOT NULL DEFAULT true;
