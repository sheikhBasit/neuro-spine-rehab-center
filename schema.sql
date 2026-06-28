-- Neuro Spine Rehab Center — full schema
-- Run once against Neon: psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'doctor', 'data_entry')),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  cnic          TEXT DEFAULT '',
  license_no    TEXT DEFAULT '',
  speciality    TEXT DEFAULT '',
  qualification TEXT DEFAULT '',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  age               INT  NOT NULL,
  guardian_name     TEXT DEFAULT '',
  cnic_bform        TEXT DEFAULT '',
  phone             TEXT NOT NULL,
  address           TEXT NOT NULL,
  queue_number      INT  NOT NULL,
  is_emergency      BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'waiting'
                      CHECK (status IN ('waiting', 'in_progress', 'done')),
  seen_by_doctor_id INT REFERENCES users(id),
  check_in_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  patient_id  INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id         SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id  INT NOT NULL REFERENCES users(id),
  medicines  JSONB,           -- [{name, dosage, instructions}]
  image_url  TEXT,            -- Cloudinary URL for prescription photo
  notes      TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
