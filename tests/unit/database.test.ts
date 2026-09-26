import { beforeAll, afterAll, describe, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

// PostgreSQL real embebido; sólo las estructuras de Auth/Storage se simulan.
// No prueba los servicios HTTP administrados por Supabase.
describe("migraciones y aislamiento PostgreSQL", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$ select string_to_array(regexp_replace(name,'/[^/]*$',''),'/') $$;
      grant select,insert,delete on storage.objects to authenticated;
    `);
    for (const name of ["202609250001_initial_schema.sql", "202609250002_profile_display_name.sql", "202609250003_catalog_journal.sql", "202609260004_ai_analyses.sql", "202609260005_weather_watering.sql"]) {
      await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
    }
  }, 60_000);
  afterAll(async () => { await db?.close(); });
  it("mantiene los permisos de Fase 1", async () => { await db.exec(await readFile("supabase/tests/phase1.sql", "utf8")); });
  it("valida RPC, cascadas, reintentos y aislamiento de Fase 3", async () => { await db.exec(await readFile("supabase/tests/phase3.sql", "utf8")); });
  it("valida permisos, cupos y confirmación de resultados de Fase 4", async () => { await db.exec(await readFile("supabase/tests/phase4.sql", "utf8")); });
  it("valida agenda dinámica, clima y diario de Fase 5", async () => { await db.exec(await readFile("supabase/tests/phase5.sql", "utf8")); });
});
