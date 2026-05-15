CREATE TABLE IF NOT EXISTS work_order_assignees (
  work_order_id text NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (work_order_id, user_id)
);
CREATE INDEX IF NOT EXISTS work_order_assignees_user_idx ON work_order_assignees(user_id);

CREATE TABLE IF NOT EXISTS maintenance_schedule_assignees (
  maintenance_schedule_id text NOT NULL REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (maintenance_schedule_id, user_id)
);
CREATE INDEX IF NOT EXISTS maintenance_schedule_assignees_user_idx ON maintenance_schedule_assignees(user_id);

INSERT INTO work_order_assignees (work_order_id, user_id)
SELECT id, assignee_id FROM work_orders WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO maintenance_schedule_assignees (maintenance_schedule_id, user_id)
SELECT id, assignee_id FROM maintenance_schedules WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;
