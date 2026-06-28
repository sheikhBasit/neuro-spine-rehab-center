CREATE TABLE IF NOT EXISTS records (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255)  NOT NULL,
  phone      VARCHAR(50)   NOT NULL,
  address    TEXT          NOT NULL,
  date       DATE          NOT NULL,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
