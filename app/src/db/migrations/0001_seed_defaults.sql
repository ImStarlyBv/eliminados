-- Seed default categories, authors and tags.
-- Idempotent: ON CONFLICT DO NOTHING on slug uniques.

INSERT INTO "categories" ("id", "slug", "name", "description") VALUES
  ('cat_farandula', 'farandula', 'Farándula', 'Chismes y noticias de la farándula.'),
  ('cat_reality',   'reality',   'Reality',   'Cobertura de realities como Planeta Alofoke.'),
  ('cat_musica',    'musica',    'Música',    'Noticias de música urbana.'),
  ('cat_deportes',  'deportes',  'Deportes',  'Noticias del deporte.'),
  ('cat_viral',     'viral',     'Viral',     'Lo más viral del internet.')
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "authors" ("id", "slug", "name", "bio", "avatar_url") VALUES
  (
    'aut_redaccion',
    'redaccion-eliminados',
    'Redacción ELIMINADOS',
    'Equipo editorial oficial de ELIMINADOS.',
    'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=200&h=200&fit=crop'
  )
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tags" ("id", "slug", "name") VALUES
  ('tag_planetaalofoke', 'planeta-alofoke',   'Planeta Alofoke'),
  ('tag_alofoke',        'alofoke',           'Alofoke'),
  ('tag_santiagomatias', 'santiago-matias',   'Santiago Matías'),
  ('tag_pamelainfante',  'pamela-infante',    'Pamela Infante'),
  ('tag_elgallo',        'el-gallo-producer', 'El Gallo Producer'),
  ('tag_viudablanca',    'viuda-blanca',      'Viuda Blanca'),
  ('tag_reality24h',     'reality-24h',       'Reality 24 horas'),
  ('tag_nataliasalas',   'natalia-salas',     'Natalia Salas'),
  ('tag_crazydesign',    'crazy-design',      'Crazy Design'),
  ('tag_lamborghini',    'lamborghini-revuelto', 'Lamborghini Revuelto')
ON CONFLICT ("slug") DO NOTHING;
