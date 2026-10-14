-- AdScore verification tables.
-- Safe to run repeatedly on MySQL 8 / MariaDB; this migration does not seed data.
-- Select the target database in the mysql command before running this file.
-- adbrief_found records whether an individual identity was found in AdBrief at
-- submission (NULL for older jobs or bulk mode); adbrief_checked_at records
-- when that check was performed. Existing tables are upgraded by the runtime
-- schema guard in adScoreVerificationModel.ts.
-- For bulk onboarding, each auto/manual row also records its consent review:
-- 'match' means the opened document matches the member, 'mismatch' means it
-- does not, and 'unverified'/NULL blocks approval. consent_file_ids stores the
-- reviewed file IDs as a comma-separated list (up to 5 files per job).
-- Existing row tables are upgraded by the same runtime schema guard.

CREATE TABLE IF NOT EXISTS ad_score_members (
  member_id      VARCHAR(20)  PRIMARY KEY,
  nama           VARCHAR(150) NOT NULL,
  tgl_lahir      DATE         NOT NULL,
  gender         CHAR(1)      NOT NULL,
  registered_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source         VARCHAR(50)  NOT NULL DEFAULT 'seed',
  INDEX idx_asm_nama (nama),
  INDEX idx_asm_dob (tgl_lahir)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ad_score_verification_jobs (
  id               VARCHAR(40)  PRIMARY KEY,
  mode             ENUM('individu','bulk') NOT NULL,
  status           ENUM('submitted','on_progress','verified','completed') NOT NULL DEFAULT 'submitted',
  submitted_by     VARCHAR(100) NOT NULL,
  identity_nama    VARCHAR(150) NULL,
  identity_tgl     DATE         NULL,
  identity_gender  CHAR(1)      NULL,
  adbrief_found    TINYINT(1)   NULL,
  adbrief_checked_at DATETIME   NULL,
  data_file_name   VARCHAR(255) NULL,
  data_file_rows   INT          NULL,
  claimed_by       VARCHAR(100) NULL,
  claimed_at       TIMESTAMP    NULL,
  picked_member_id VARCHAR(20)  NULL,
  rejection_reason TEXT         NULL,
  fix_category     VARCHAR(60)  NULL,
  fix_note         TEXT         NULL,
  outcome          VARCHAR(255) NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asv_status (status),
  INDEX idx_asv_created (created_at),
  INDEX idx_asv_owner_status_created (submitted_by, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ad_score_verification_rows (
  row_id    VARCHAR(40)  PRIMARY KEY,
  job_id    VARCHAR(40)  NOT NULL,
  row_no    INT          NOT NULL,
  nama      VARCHAR(150) NOT NULL,
  tgl_lahir DATE         NULL,
  gender    CHAR(1)      NULL,
  state     ENUM('auto','manual','notfound','unresolved') NOT NULL DEFAULT 'unresolved',
  member_id VARCHAR(20)  NULL,
  consent_state      ENUM('unverified','match','mismatch') NULL,
  consent_checked_by VARCHAR(100) NULL,
  consent_checked_at DATETIME NULL,
  consent_note       VARCHAR(500) NULL,
  consent_file_ids   VARCHAR(500) NULL,
  INDEX idx_asvr_job (job_id),
  CONSTRAINT fk_asvr_job FOREIGN KEY (job_id)
    REFERENCES ad_score_verification_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ad_score_consent_files (
  id          VARCHAR(40)  PRIMARY KEY,
  job_id      VARCHAR(40)  NOT NULL,
  name        VARCHAR(255) NOT NULL,
  content     LONGBLOB     NULL,
  size        INT          NOT NULL,
  type        VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
  uploaded_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_by  VARCHAR(100) NULL,
  checked_at  TIMESTAMP    NULL,
  INDEX idx_ascf_job (job_id),
  CONSTRAINT fk_ascf_job FOREIGN KEY (job_id)
    REFERENCES ad_score_verification_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ad_score_consent_file_chunks (
  file_id   VARCHAR(40) NOT NULL,
  chunk_no  INT         NOT NULL,
  content   MEDIUMBLOB  NOT NULL,
  PRIMARY KEY (file_id, chunk_no),
  CONSTRAINT fk_ascfc_file FOREIGN KEY (file_id)
    REFERENCES ad_score_consent_files(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ad_score_verification_audit (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id     VARCHAR(40)  NULL,
  action     VARCHAR(40)  NOT NULL,
  actor      VARCHAR(100) NOT NULL,
  detail     VARCHAR(500) NOT NULL,
  outcome    VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asva_job (job_id),
  INDEX idx_asva_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;