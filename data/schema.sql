CREATE TABLE majors (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  discipline TEXT NOT NULL,
  degree TEXT,
  duration TEXT,
  is_special INTEGER NOT NULL DEFAULT 0,
  is_controlled INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  core_courses TEXT,
  career_directions TEXT,
  postgraduate_directions TEXT,
  suitable_personality TEXT,
  skill_requirements TEXT,
  ai_summary TEXT,
  faq_json TEXT,
  source_note TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE universities (
  id INTEGER PRIMARY KEY,
  moe_code TEXT UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT,
  level TEXT,
  type TEXT,
  ownership TEXT,
  authority TEXT,
  tags TEXT,
  website TEXT,
  admission_site TEXT,
  source_note TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE university_majors (
  id INTEGER PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES universities(id),
  major_id INTEGER NOT NULL REFERENCES majors(id),
  province TEXT,
  year INTEGER,
  degree TEXT,
  duration TEXT,
  tuition INTEGER,
  campus TEXT,
  subject_requirements TEXT,
  notes TEXT,
  source_note TEXT NOT NULL,
  UNIQUE(university_id, major_id, province, year)
);

CREATE TABLE admission_plans (
  id INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  province TEXT NOT NULL,
  university_id INTEGER NOT NULL REFERENCES universities(id),
  major_id INTEGER NOT NULL REFERENCES majors(id),
  batch TEXT,
  subject_group TEXT,
  plan_count INTEGER,
  tuition INTEGER,
  campus TEXT,
  remarks TEXT,
  source_note TEXT NOT NULL
);

CREATE TABLE admission_scores (
  id INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  province TEXT NOT NULL,
  university_id INTEGER NOT NULL REFERENCES universities(id),
  major_id INTEGER REFERENCES majors(id),
  data_grain TEXT NOT NULL DEFAULT 'major',
  major_group_code TEXT,
  major_group_name TEXT,
  batch TEXT,
  subject_group TEXT,
  min_score INTEGER,
  min_rank INTEGER,
  avg_score INTEGER,
  max_score INTEGER,
  plan_count INTEGER,
  source_url TEXT,
  published_at TEXT,
  source_note TEXT NOT NULL
);

CREATE TABLE career_profiles (
  id INTEGER PRIMARY KEY,
  major_id INTEGER NOT NULL REFERENCES majors(id),
  occupation TEXT NOT NULL,
  industry TEXT,
  salary_level TEXT,
  demand_trend TEXT,
  ai_risk TEXT,
  city_fit TEXT,
  source_note TEXT NOT NULL
);

CREATE TABLE university_progression (
  id INTEGER PRIMARY KEY,
  university_id INTEGER NOT NULL REFERENCES universities(id),
  year INTEGER,
  cohort TEXT,
  undergraduate_count INTEGER,
  domestic_study_rate TEXT,
  overseas_study_rate TEXT,
  further_study_rate TEXT,
  recommendation_rate TEXT,
  recommendation_basis TEXT,
  status TEXT NOT NULL DEFAULT '待补充',
  source_name TEXT,
  source_url TEXT,
  extra_source_urls TEXT,
  source_note TEXT NOT NULL
);

CREATE TABLE seo_pages (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT,
  canonical TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  UNIQUE(type, slug)
);

CREATE TABLE user_feedback (
  id INTEGER PRIMARY KEY,
  page_url TEXT,
  feedback_type TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  contact TEXT,
  source_payload TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE volunteer_lists (
  id INTEGER PRIMARY KEY,
  province TEXT NOT NULL,
  rank INTEGER,
  preferences_json TEXT,
  health_score INTEGER,
  risk_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE volunteer_items (
  id INTEGER PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES volunteer_lists(id),
  position INTEGER NOT NULL,
  university_id INTEGER REFERENCES universities(id),
  major_id INTEGER REFERENCES majors(id),
  raw_university TEXT,
  raw_major TEXT,
  city TEXT,
  band TEXT,
  match_score INTEGER,
  satisfaction_score INTEGER,
  sort_reason TEXT,
  risk_note TEXT
);

CREATE TABLE IF NOT EXISTS email_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL,
  last_login_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS email_login_codes (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  user_agent TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_login_sessions (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  last_seen_at_ms INTEGER
);

CREATE INDEX idx_majors_name ON majors(name);
CREATE INDEX idx_universities_name ON universities(name);
CREATE INDEX idx_university_majors_major ON university_majors(major_id);
CREATE INDEX idx_scores_province_rank ON admission_scores(province, year, min_rank);
CREATE INDEX idx_feedback_status ON user_feedback(status, created_at);
CREATE INDEX idx_volunteer_items_list ON volunteer_items(list_id, position);
CREATE INDEX IF NOT EXISTS idx_email_login_codes_email_created ON email_login_codes(email, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_email_login_codes_ip_created ON email_login_codes(ip_hash, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_email_login_sessions_email ON email_login_sessions(email, expires_at_ms);
CREATE INDEX IF NOT EXISTS idx_email_login_sessions_expires ON email_login_sessions(expires_at_ms);
