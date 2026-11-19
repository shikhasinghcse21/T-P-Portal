-- ================================================================
--  T&P PORTAL — database.sql
--  Rewa Engineering College
--  Run command: mysql -u root -p < database.sql
-- ================================================================

CREATE DATABASE IF NOT EXISTS tp_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tp_portal;

-- ── STUDENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    enrollment       VARCHAR(30)   NOT NULL UNIQUE,
    pass_hash        VARCHAR(255)  NOT NULL,
    name             VARCHAR(100)  DEFAULT '',
    email            VARCHAR(120)  NOT NULL UNIQUE,
    mobile           VARCHAR(15)   DEFAULT '',
    branch           VARCHAR(10)   DEFAULT 'CSE',
    sem              VARCHAR(10)   DEFAULT 'Sem 1',
    cgpa             DECIMAL(4,2)  DEFAULT 0.00,
    backlogs         INT           DEFAULT 0,
    tenth            DECIMAL(5,2)  DEFAULT 0.00,
    twelfth          DECIMAL(5,2)  DEFAULT 0.00,
    sgpa1            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa2            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa3            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa4            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa5            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa6            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa7            DECIMAL(4,2)  DEFAULT 0.00,
    sgpa8            DECIMAL(4,2)  DEFAULT 0.00,
    profile_pic      LONGTEXT      DEFAULT '',
    verified         TINYINT(1)    DEFAULT 0,
    debarred         TINYINT(1)    DEFAULT 0,
    placement_status VARCHAR(20)   DEFAULT 'Seeking',
    placed_at        VARCHAR(100)  DEFAULT '',
    reg_date         DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ── RECRUITERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruiters (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    email            VARCHAR(120)  NOT NULL UNIQUE,
    pass_hash        VARCHAR(255)  NOT NULL,
    name             VARCHAR(100)  NOT NULL,
    company          VARCHAR(100)  NOT NULL,
    position         VARCHAR(100)  DEFAULT '',
    phone            VARCHAR(15)   DEFAULT '',
    verified         TINYINT(1)    DEFAULT 0,
    reg_date         DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ── JOBS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    company          VARCHAR(100)  NOT NULL,
    role             VARCHAR(100)  NOT NULL,
    ctc              VARCHAR(30)   NOT NULL,
    branches         VARCHAR(200)  NOT NULL,
    min_cgpa         DECIMAL(4,2)  DEFAULT 6.00,
    drive_date       DATE          DEFAULT NULL,
    description      TEXT          DEFAULT '',
    posted_by        INT           NOT NULL,
    applicant_count  INT           DEFAULT 0,
    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (posted_by) REFERENCES recruiters(id) ON DELETE CASCADE
);

-- ── APPLICATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    job_id           INT           NOT NULL,
    enrollment       VARCHAR(30)   NOT NULL,
    status           VARCHAR(30)   DEFAULT 'Applied',
    applied_date     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id)     REFERENCES jobs(id)              ON DELETE CASCADE,
    FOREIGN KEY (enrollment) REFERENCES students(enrollment)  ON DELETE CASCADE,
    UNIQUE KEY unique_app (job_id, enrollment)
);

-- ── COURSES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    course_key       VARCHAR(50)   NOT NULL UNIQUE,
    title            VARCHAR(200)  NOT NULL,
    category         VARCHAR(30)   NOT NULL,
    branch           VARCHAR(10)   DEFAULT 'ALL',
    sem              VARCHAR(10)   DEFAULT 'ALL',
    badge            VARCHAR(100)  DEFAULT '',
    yt_video_id      VARCHAR(25)   DEFAULT '',
    yt_link          VARCHAR(300)  DEFAULT '',
    total_lectures   INT           DEFAULT 10,
    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ── COURSE PROGRESS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_progress (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    enrollment       VARCHAR(30)   NOT NULL,
    course_key       VARCHAR(50)   NOT NULL,
    done             INT           DEFAULT 0,
    total            INT           DEFAULT 10,
    updated_at       DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_progress (enrollment, course_key),
    FOREIGN KEY (enrollment)  REFERENCES students(enrollment) ON DELETE CASCADE,
    FOREIGN KEY (course_key)  REFERENCES courses(course_key)  ON DELETE CASCADE
);

-- ── CERTIFICATES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    enrollment       VARCHAR(30)   NOT NULL,
    course_key       VARCHAR(50)   NOT NULL,
    issued_date      DATETIME      DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cert (enrollment, course_key),
    FOREIGN KEY (enrollment)  REFERENCES students(enrollment) ON DELETE CASCADE,
    FOREIGN KEY (course_key)  REFERENCES courses(course_key)  ON DELETE CASCADE
);

-- ================================================================
-- SEED COURSES
-- ================================================================
INSERT IGNORE INTO courses (course_key,title,category,branch,sem,badge,yt_video_id,yt_link,total_lectures) VALUES
('prep-apti',  'Quantitative Aptitude & Reasoning (Complete)',    'PLACEMENT_PREP','ALL','ALL',  '🔢 Apti-Guru',   'LnfarCGiGb4','https://youtu.be/LnfarCGiGb4',20),
('prep-soft',  'Soft Skills & Corporate Communication',           'PLACEMENT_PREP','ALL','ALL',  '👔 Soft-Skills',  'HAnw168huqA','https://youtu.be/HAnw168huqA',15),
('prep-hr',    'HR Interview Preparation — Top 50 Questions',     'PLACEMENT_PREP','ALL','ALL',  '💼 HR-Ready',     '1qw5ITr3k9E','https://youtu.be/1qw5ITr3k9E',12),
('prep-resume','Resume Building & LinkedIn Profile Masterclass',  'PLACEMENT_PREP','ALL','ALL',  '📄 Resume-Pro',   'y8YH0Qbu5h4','https://youtu.be/y8YH0Qbu5h4',8),
('prep-gd',    'Group Discussion Techniques & Case Studies',      'PLACEMENT_PREP','ALL','ALL',  '🗣️ GD-Champ',    'hCahBg3yEBU','https://youtu.be/hCahBg3yEBU',10),
('prep-tcs',   'TCS NQT & Infosys Placement Mock Tests',          'PLACEMENT_PREP','ALL','Sem 7','⚡ TCS-Star',     'V9vEBpyxWfc','https://youtu.be/V9vEBpyxWfc',14),
('cse-s1',     'C Programming Full Course for Beginners',         'CORE_BRANCH','CSE','Sem 1',  '💻 C-Expert',     'irqbmMNs2Bo','https://youtu.be/irqbmMNs2Bo',22),
('cse-s2',     'Object-Oriented Programming with C++',            'CORE_BRANCH','CSE','Sem 2',  '🚀 C++-Master',   'vLnPwxZdW4Y','https://youtu.be/vLnPwxZdW4Y',20),
('cse-s3',     'Data Structures & Algorithms — Full Course',      'CORE_BRANCH','CSE','Sem 3',  '🧱 DSA-Expert',   'RBSGKlAvoiM','https://youtu.be/RBSGKlAvoiM',30),
('cse-s4',     'Database Management Systems & SQL Full Course',   'CORE_BRANCH','CSE','Sem 4',  '🗄️ SQL-Ninja',   'HXV3zeQKqGY','https://youtu.be/HXV3zeQKqGY',18),
('cse-s5',     'Operating Systems — Complete Course',             'CORE_BRANCH','CSE','Sem 5',  '⚙️ OS-Kernel',   '26QPDBe-NB8','https://youtu.be/26QPDBe-NB8',24),
('cse-s6',     'Computer Networks — Full Course',                 'CORE_BRANCH','CSE','Sem 6',  '🌐 Network-Pro',  'qiQR5rTSshw','https://youtu.be/qiQR5rTSshw',22),
('cse-s7',     'Full-Stack Web Development Bootcamp',             'CORE_BRANCH','CSE','Sem 7',  '🎨 FullStack',    'ysEN5RaKOlA','https://youtu.be/ysEN5RaKOlA',28),
('cse-s8',     'Cloud Computing & AWS Full Course',               'CORE_BRANCH','CSE','Sem 8',  '☁️ Cloud-Guru',  'M988_fsOSWo','https://youtu.be/M988_fsOSWo',20),
('it-s1',      'IT Fundamentals & Computer Hardware',             'CORE_BRANCH','IT','Sem 1',   '🖥️ IT-Core',     'zOjov-2OZ0E','https://youtu.be/zOjov-2OZ0E',16),
('it-s3',      'Java Programming Full Course',                    'CORE_BRANCH','IT','Sem 3',   '☕ Java-Pro',     'grEKMHGYyns','https://youtu.be/grEKMHGYyns',22),
('it-s5',      'Software Engineering & Agile Methodologies',      'CORE_BRANCH','IT','Sem 5',   '🛠️ Agile-Dev',   'Fi3_BjVzpqk','https://youtu.be/Fi3_BjVzpqk',18),
('it-s7',      'AWS Cloud Architecture Complete Course',          'CORE_BRANCH','IT','Sem 7',   '☁️ AWS-Pro',     'M988_fsOSWo','https://youtu.be/M988_fsOSWo',24),
('ece-s1',     'Basic Electronics — Circuits & Devices',          'CORE_BRANCH','ECE','Sem 1',  '⚡ Circuit-Pro',  'nb4ovfwqup8','https://youtu.be/nb4ovfwqup8',20),
('ece-s3',     'Electronic Devices & Analog Circuits',            'CORE_BRANCH','ECE','Sem 3',  '📟 Analog-Pro',   'm4jzgqZu-4s','https://youtu.be/m4jzgqZu-4s',22),
('ece-s5',     'Digital Communication Engineering',               'CORE_BRANCH','ECE','Sem 5',  '📡 Signal-Comm',  '1JSlnzjsS5Y','https://youtu.be/1JSlnzjsS5Y',24),
('ece-s7',     'Embedded Systems & IoT Full Course',              'CORE_BRANCH','ECE','Sem 7',  '📟 IoT-Master',   'zJ3oTM-BdZk','https://youtu.be/zJ3oTM-BdZk',20),
('me-s3',      'Strength of Materials — Full Course',             'CORE_BRANCH','ME','Sem 3',   '💪 SOM-Expert',   'f08Y39UiC-o','https://youtu.be/f08Y39UiC-o',20),
('me-s5',      'Thermodynamics Complete Course',                  'CORE_BRANCH','ME','Sem 5',   '🔥 Thermo-Pro',   'vwg1EyK4f_c','https://youtu.be/vwg1EyK4f_c',22),
('me-s7',      'Robotics & Automation Engineering',               'CORE_BRANCH','ME','Sem 7',   '🤖 Robot-King',   'bZA-u0VDwuo','https://youtu.be/bZA-u0VDwuo',18),
('ce-s3',      'Surveying & Geomatics Engineering',               'CORE_BRANCH','CE','Sem 3',   '🗺️ Surveyor',    '8SYVDqIqHAM','https://youtu.be/8SYVDqIqHAM',16),
('ce-s5',      'Fluid Mechanics & Hydraulic Machines',            'CORE_BRANCH','CE','Sem 5',   '💧 Hydro-Eng',    '9A1s_Vu-iRU','https://youtu.be/9A1s_Vu-iRU',18),
('ce-s7',      'Transportation Engineering Complete Course',      'CORE_BRANCH','CE','Sem 7',   '🛣️ Transport-Pro','DKe8VfBEr_4','https://youtu.be/DKe8VfBEr_4',16),
('ee-s3',      'Electrical Machines — Motors & Transformers',     'CORE_BRANCH','EE','Sem 3',   '⚡ EE-Expert',    'b4TLQ4RJdvI','https://youtu.be/b4TLQ4RJdvI',20),
('ee-s5',      'Power Systems Analysis Full Course',              'CORE_BRANCH','EE','Sem 5',   '🔌 Power-Pro',    '26QPDBe-NB8','https://youtu.be/26QPDBe-NB8',22);
