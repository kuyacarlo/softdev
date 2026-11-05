-- Demo data for local development only (`npm run db:seed:local`). Not a migration.
INSERT OR IGNORE INTO admin_staff (full_name, email, role, active, created_at) VALUES
  ('Maria Santos', 'manager@campus.edu', 'facility_manager', 1, 0),
  ('Jose Reyes',   'desk@campus.edu',    'front_desk',       1, 0);

INSERT OR IGNORE INTO study_pod (label, name, building, floor, capacity, amenities, status, created_at, updated_at) VALUES
  ('MAIN-2-A1', 'Quiet Pod A1',         'Main Library',     2, 1, '["Power outlet","Desk lamp"]',                      'active', 0, 0),
  ('MAIN-2-A2', 'Quiet Pod A2',         'Main Library',     2, 1, '["Power outlet","Desk lamp"]',                      'active', 0, 0),
  ('MAIN-2-A3', 'Quiet Pod A3',         'Main Library',     2, 1, '["Power outlet"]',                                  'active', 0, 0),
  ('MAIN-3-G1', 'Group Pod G1',         'Main Library',     3, 4, '["Whiteboard","Power outlet","Monitor"]',           'active', 0, 0),
  ('MAIN-3-G2', 'Group Pod G2',         'Main Library',     3, 6, '["Whiteboard","Power outlet","Monitor","HDMI"]',    'active', 0, 0),
  ('MAIN-3-G3', 'Group Pod G3',         'Main Library',     3, 4, '["Whiteboard"]',                                    'maintenance', 0, 0),
  ('ENG-1-S1',  'Engineering Solo 1',   'Engineering Commons', 1, 1, '["Power outlet","Ergonomic chair"]',             'active', 0, 0),
  ('ENG-1-S2',  'Engineering Solo 2',   'Engineering Commons', 1, 1, '["Power outlet","Ergonomic chair"]',             'active', 0, 0),
  ('ENG-2-G1',  'Engineering Group 1',  'Engineering Commons', 2, 5, '["Whiteboard","Monitor","Power outlet"]',        'active', 0, 0),
  ('ENG-2-D1',  'Engineering Duo 1',    'Engineering Commons', 2, 2, '["Power outlet","Monitor"]',                     'active', 0, 0);
