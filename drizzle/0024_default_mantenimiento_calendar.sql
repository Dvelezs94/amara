-- Default calendar for maintenance schedules
INSERT INTO calendars (id, name, color, sort_order)
VALUES ('cal_mantenimiento', 'Mantenimiento', '#02257D', 0)
ON CONFLICT (id) DO NOTHING;

UPDATE maintenance_schedules
SET calendar_id = 'cal_mantenimiento'
WHERE calendar_id IS NULL;
