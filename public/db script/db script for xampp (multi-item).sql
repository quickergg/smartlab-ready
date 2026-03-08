-- ====================================================
-- Laboratory Management System for XAMPP / MySQL
-- ====================================================

CREATE DATABASE lab_mgmt;

-- Table to store academic year (e.g. 2025-2026)
CREATE TABLE academic_year (
  academic_year_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique ID for academic years
  academic_year VARCHAR(20) NOT NULL UNIQUE, -- Academic year (e.g. 2025-2026)
  is_active BOOLEAN NOT NULL DEFAULT FALSE -- Flag for active academic year
);

-- Table to store term (e.g. 1st Semester, 2nd Semester, Summer)
CREATE TABLE term (
  term_id INT AUTO_INCREMENT PRIMARY KEY, -- Unique ID for terms
  term VARCHAR(20) NOT NULL UNIQUE, -- Term (e.g. 1st Semester, 2nd Semester, Summer)
  is_active BOOLEAN NOT NULL DEFAULT FALSE -- Flag for active term
);

-- Table to store campus buildings
CREATE TABLE campus_building (
  building_id INT AUTO_INCREMENT PRIMARY KEY,
  building_name VARCHAR(100) NOT NULL UNIQUE
);

-- Table to store campus rooms
CREATE TABLE campus_room (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  building_id INT NULL,
  room_number VARCHAR(20) NOT NULL,
  room_name VARCHAR(120) NOT NULL,
  is_computer_lab TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT uq_room_number UNIQUE (room_number, building_id),
  CONSTRAINT fk_room_building FOREIGN KEY (building_id) REFERENCES campus_building(building_id) ON DELETE SET NULL
);

-- Table to store academic programs
CREATE TABLE campus_program (
  program_id INT AUTO_INCREMENT PRIMARY KEY,
  program_code VARCHAR(20) NOT NULL UNIQUE,
  program_name VARCHAR(150) NOT NULL
);

-- Table to store academic subjects
CREATE TABLE campus_subject (
  subject_id INT AUTO_INCREMENT PRIMARY KEY,
  subject_code VARCHAR(20) NOT NULL UNIQUE,
  subject_name VARCHAR(150) NOT NULL
);

-- Table to store faculty departments
CREATE TABLE campus_department (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  department_code VARCHAR(20) NOT NULL UNIQUE,
  department_name VARCHAR(150) NOT NULL
);

-- Table to store user status (e.g., Active, Deactivated)
CREATE TABLE user_status (
  status_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the status
  status_name VARCHAR(50) NOT NULL UNIQUE  -- Status name (e.g., Active, Deactivated)
);

-- Table to store user role (e.g., Admin, Faculty, Student)
CREATE TABLE user_role (
  role_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the role
  role_name VARCHAR(50) NOT NULL UNIQUE  -- Role name (e.g., Admin, Faculty, Student)
);

-- 1. Create the 'user' table to store general user data
CREATE TABLE user (
  user_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the user
  gmail VARCHAR(100) NOT NULL UNIQUE,  -- Username (e.g., seansalabo@gmail.com)
  password_hash VARCHAR(255) NOT NULL,  -- Hashed password
  role_id INT NOT NULL,  -- Foreign Key to 'user_role' (e.g., Admin, Faculty)
  status_id INT NOT NULL DEFAULT 1,  -- Foreign Key to 'user_status' (e.g., Active, Inactive)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Timestamp for account creation
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  -- Timestamp for last update
  last_login_at DATETIME NULL,  -- Timestamp for last login
  CONSTRAINT fk_user_status FOREIGN KEY (status_id) REFERENCES user_status(status_id),  -- Foreign key constraint to 'user_status'
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES user_role(role_id)  -- Foreign key constraint to 'user_role'
);

-- 2. Create faculty profile table, extending the 'user' table
CREATE TABLE faculty_profile (
  faculty_id INT PRIMARY KEY,  -- Foreign Key to 'user' table (faculty)
  full_name VARCHAR(50),  -- Full name of the faculty member
  department_id INT NULL,  -- Linked department from campus_department
  CONSTRAINT fk_faculty_user FOREIGN KEY (faculty_id) REFERENCES user(user_id) ON DELETE CASCADE,  -- Foreign key constraint to 'user'
  CONSTRAINT fk_faculty_department FOREIGN KEY (department_id) REFERENCES campus_department(department_id) ON DELETE SET NULL
);

-- 3. Create student profile table, extending the 'user' table
CREATE TABLE student_profile (
  student_id INT PRIMARY KEY,  -- Foreign Key to 'user' table (student)
  full_name VARCHAR(50),  -- Full name of the student
  program_id INT NULL,  -- Linked program from campus_program
  year_level INT,  -- Year level (e.g. 1, 2, 3, 4)
  CONSTRAINT fk_student_user FOREIGN KEY (student_id) REFERENCES user(user_id) ON DELETE CASCADE,  -- Foreign key constraint to 'user'
  CONSTRAINT fk_student_program FOREIGN KEY (program_id) REFERENCES campus_program(program_id) ON DELETE SET NULL
);

-- 3.1. Create admin profile table, extending the 'user' table
CREATE TABLE admin_profile (
  admin_id INT PRIMARY KEY,  -- Foreign Key to 'user' table (admin)
  full_name VARCHAR(50),  -- Full name of the admin
  CONSTRAINT fk_admin_user FOREIGN KEY (admin_id) REFERENCES user(user_id) ON DELETE CASCADE  -- Foreign key constraint to 'user'
);

-- 4. Create the 'lab_schedule' table to manage laboratory room scheduling
-- schedule_date = NULL → recurring weekly schedule (uses day_of_week)
-- schedule_date = DATE → one-time schedule for that specific date only
CREATE TABLE lab_schedule (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the schedule
  room_id INT NULL,  -- Linked campus_room id for canonical reference
  faculty_id INT NOT NULL,  -- Foreign Key to 'user' table (faculty)
  program_id INT NULL,  -- Linked campus_program id for canonical reference
  year_level INT,  -- Year level (e.g 1, 2, 3, 4)
  subject_id INT NULL,  -- Linked campus_subject id for canonical reference
  day_of_week VARCHAR(10) NOT NULL,  -- Day of the week (e.g., Monday)
  schedule_date DATE NULL DEFAULT NULL,  -- Specific date for one-time schedules (NULL = recurring)
  borrow_request_id INT NULL DEFAULT NULL,  -- Links to originating borrow request (NULL = manually created)
  time_start TIME NOT NULL,  -- Start time of the class (e.g., 08:00:00)
  time_end TIME NOT NULL,  -- End time of the class (e.g., 10:00:00)
  academic_year_id INT NOT NULL,  -- Academic year (e.g., 2025-2026)
  term_id INT NOT NULL, -- Semester (e.g. 1st Semester, 2nd Semester, Summer)
  created_by INT NOT NULL,  -- Admin who created the schedule
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Timestamp for schedule creation
  CONSTRAINT fk_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_year(academic_year_id), -- Foreign key constraint to 'academic_year'
  CONSTRAINT fk_term FOREIGN KEY (term_id) REFERENCES term(term_id), -- Foreign key constraint to 'term'
  CONSTRAINT fk_sched_faculty FOREIGN KEY (faculty_id) REFERENCES user(user_id),  -- Foreign key constraint to 'user'
  CONSTRAINT fk_sched_created_by FOREIGN KEY (created_by) REFERENCES user(user_id),  -- Foreign key constraint to 'user'
  CONSTRAINT fk_sched_subject FOREIGN KEY (subject_id) REFERENCES campus_subject(subject_id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_program FOREIGN KEY (program_id) REFERENCES campus_program(program_id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_room FOREIGN KEY (room_id) REFERENCES campus_room(room_id) ON DELETE SET NULL,
  INDEX idx_schedule_date (schedule_date),  -- Fast date lookups
  INDEX idx_sched_borrow_request (borrow_request_id),  -- Fast FK lookups
  CHECK (time_end > time_start)  -- Ensure that the end time is after the start time
);

-- Table to store equipment status (e.g., Available, Borrowed, Damaged)
CREATE TABLE equipment_status (
  status_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the status
  status_name VARCHAR(50) NOT NULL UNIQUE  -- Status name (e.g., Available, Borrowed, Damaged)
);

-- 5. Create the 'equipment' table to manage laboratory equipment (WITH INVENTORY)
CREATE TABLE equipment (
  equipment_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the equipment
  equipment_name VARCHAR(255) NOT NULL,         -- Name/type (e.g., Projector, Laptop)
  status_id INT NOT NULL DEFAULT 1,                       -- General status (e.g., Available, Damaged)
  
  -- Inventory fields
  total_qty INT NOT NULL DEFAULT 0,             -- Total units owned
  available_qty INT NOT NULL DEFAULT 0,         -- Units currently available
  borrowed_qty INT NOT NULL DEFAULT 0,          -- Units currently borrowed (computed/maintained by app or triggers)
  damaged_qty INT NOT NULL DEFAULT 0,           -- Units marked damaged
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_equipment_status
    FOREIGN KEY (status_id) REFERENCES equipment_status(status_id),

  CHECK (total_qty >= 0),
  CHECK (available_qty >= 0),
  CHECK (borrowed_qty >= 0),
  CHECK (damaged_qty >= 0),
  CHECK (available_qty <= total_qty),
  CHECK (borrowed_qty <= total_qty),
  CHECK (damaged_qty <= total_qty)
);

-- Table to store borrow request status (e.g., Pending, Cancelled, Approved)
CREATE TABLE borrow_request_status (
  status_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the status
  status_name VARCHAR(50) NOT NULL UNIQUE  -- Status name (e.g., Pending, Cancelled, Approved)
);

-- 6. Create the 'borrow_request' table for tracking borrow requests (lab or equipment)
CREATE TABLE borrow_request (
  borrow_request_id INT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the borrow request
  requested_by INT NOT NULL,  -- Foreign Key to 'user' (Student or Faculty)
  lab_schedule_id INT NULL,  -- Foreign Key to 'lab_schedule' (if reserving a lab room)
  faculty_id INT NULL,  -- Foreign Key to 'faculty_profile' (if faculty is requesting)
  subject_id INT NULL,  -- Linked subject from campus_subject
  program_id INT NULL,  -- Linked program from campus_program
  year_level INT,  -- Year level (e.g. 1, 2, 3, 4)
  date_needed DATE NOT NULL,  -- Date the equipment or lab is needed
  room_id INT NULL,  -- Linked room from campus_room
  time_start TIME, -- Time start of the schedule
  time_end TIME, -- Time end of the schedule
  contact_details VARCHAR(20),  -- Contact details (e.g., phone number)
  purpose VARCHAR(100) NULL,  -- Purpose of borrowing the equipment or lab
  note VARCHAR(250) NULL,  -- Rejection by the admin
  status_id INT NOT NULL,  -- Foreign Key to 'borrow_request_status' (e.g., Pending, Approved)
  academic_year_id INT NULL,  -- Academic year (e.g., 2025-2026)
  term_id INT NULL, -- Semester (e.g. 1st Semester, 2nd Semester, Summer)
  reviewed_by INT NULL,  -- Admin who reviewed the request (optional)
  reviewed_at DATETIME NULL,  -- Timestamp for when the request was reviewed
  approved_at DATETIME NULL,  -- Timestamp when the request was approved
  borrowed_at DATETIME NULL,  -- Timestamp when the request was marked as borrowed
  returned_at DATETIME NULL,  -- Timestamp when the request was marked as returned
  cancelled_at DATETIME NULL, -- Timestamp when the request was cancelled
  declined_at DATETIME NULL,  -- Timestamp when the request was declined
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Timestamp for request creation
  CONSTRAINT fk_borrowreq_user FOREIGN KEY (requested_by) REFERENCES user(user_id),  -- Foreign key constraint to 'user'
  CONSTRAINT fk_borrowreq_lab FOREIGN KEY (lab_schedule_id) REFERENCES lab_schedule(schedule_id),  -- Foreign key constraint to 'lab_schedule'
  CONSTRAINT fk_borrowreq_status FOREIGN KEY (status_id) REFERENCES borrow_request_status(status_id),  -- Foreign key constraint to 'borrow_request_status'
  CONSTRAINT fk_borrowreq_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_year(academic_year_id), -- Foreign key constraint to 'academic_year'
  CONSTRAINT fk_borrowreq_term FOREIGN KEY (term_id) REFERENCES term(term_id), -- Foreign key constraint to 'term'
  CONSTRAINT fk_borrowreq_reviewer FOREIGN KEY (reviewed_by) REFERENCES user(user_id), -- Foreign key constraint to 'user'
  CONSTRAINT fk_borrowreq_faculty FOREIGN KEY (faculty_id) REFERENCES faculty_profile(faculty_id), -- Foreign key constraint to 'faculty_profile'
  CONSTRAINT fk_borrowreq_subject FOREIGN KEY (subject_id) REFERENCES campus_subject(subject_id) ON DELETE SET NULL,
  CONSTRAINT fk_borrowreq_program FOREIGN KEY (program_id) REFERENCES campus_program(program_id) ON DELETE SET NULL,
  CONSTRAINT fk_borrowreq_room FOREIGN KEY (room_id) REFERENCES campus_room(room_id) ON DELETE SET NULL
);

-- 6.0.1 Add deferred FK: lab_schedule.borrow_request_id → borrow_request
-- (Defined after both tables exist to avoid circular CREATE ordering issues)
ALTER TABLE lab_schedule
  ADD CONSTRAINT fk_sched_borrow_request
  FOREIGN KEY (borrow_request_id) REFERENCES borrow_request(borrow_request_id)
  ON DELETE SET NULL;

-- 6.1. Create the 'borrow_request_item' table to link borrow requests with equipment (WITH QTY)
CREATE TABLE borrow_request_item (
  borrow_request_item_id INT AUTO_INCREMENT PRIMARY KEY,
  borrow_request_id INT NOT NULL,
  equipment_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,             

  CONSTRAINT fk_borrow_request
    FOREIGN KEY (borrow_request_id) REFERENCES borrow_request(borrow_request_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),

  CHECK (quantity >= 1)
);

-- 7. Create the 'notification' table for in-app + email notifications
CREATE TABLE notification (
  notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,                          -- Recipient
  type VARCHAR(50) NOT NULL,                     -- e.g. request_approved, request_declined, new_request
  title VARCHAR(255) NOT NULL,                   -- Short title shown in bell dropdown
  message TEXT NOT NULL,                         -- Full message body
  reference_type VARCHAR(50) NULL,               -- e.g. borrow_request
  reference_id INT NULL,                         -- e.g. borrow_request_id
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
  INDEX idx_notification_user_read (user_id, is_read),
  INDEX idx_notification_created (created_at)
);

-- 8. Create the 'audit_log' table to log admin actions for auditing purposes
CREATE TABLE audit_log (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,  -- Unique ID for the audit log entry
  actor_user_id INT NOT NULL,  -- Admin who performed the action
  action VARCHAR(255) NOT NULL,  -- Description of the action (e.g., "Approved borrow request")
  entity_type VARCHAR(50) NOT NULL,  -- Type of entity affected (e.g., "Borrow Request")
  entity_id INT NOT NULL,  -- ID of the affected entity (e.g., borrow request ID)
  details JSON NULL,  -- Additional details (optional)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Timestamp for audit log creation
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES user(user_id)  -- Foreign key constraint to 'user'
);

-- 8. Create comprehensive equipment status auto-update triggers
DELIMITER $$

CREATE TRIGGER before_equipment_update
BEFORE UPDATE ON equipment
FOR EACH ROW
BEGIN
    DECLARE new_status_id INT;
    
    -- Calculate available quantity
    SET NEW.available_qty = GREATEST(0, NEW.total_qty - NEW.borrowed_qty - NEW.damaged_qty);
    
    -- Set status based on quantities
    IF NEW.total_qty = 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Unavailable' LIMIT 1);
    ELSEIF NEW.available_qty > 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Available' LIMIT 1);
    ELSEIF NEW.total_qty > 0 AND NEW.available_qty = 0 AND NEW.borrowed_qty > 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Borrowed' LIMIT 1);
    ELSEIF NEW.total_qty > 0 AND NEW.available_qty = 0 AND NEW.borrowed_qty = 0 AND NEW.damaged_qty > 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Damaged' LIMIT 1);
    ELSE
        IF NEW.total_qty > 0 THEN
            SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Available' LIMIT 1);
        ELSE
            SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Unavailable' LIMIT 1);
        END IF;
    END IF;
END$$

-- Create comprehensive trigger for INSERT operations
CREATE TRIGGER before_equipment_insert
BEFORE INSERT ON equipment
FOR EACH ROW
BEGIN
    -- Calculate available quantity
    IF NEW.available_qty IS NULL OR NEW.available_qty = 0 THEN
        SET NEW.available_qty = GREATEST(0, NEW.total_qty - NEW.borrowed_qty - NEW.damaged_qty);
    END IF;
    
    -- Set status based on quantities
    IF NEW.total_qty = 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Unavailable' LIMIT 1);
    ELSEIF NEW.available_qty > 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Available' LIMIT 1);
    ELSEIF NEW.total_qty > 0 AND NEW.available_qty = 0 AND NEW.borrowed_qty > 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Borrowed' LIMIT 1);
    ELSEIF NEW.total_qty > 0 AND NEW.available_qty = 0 AND NEW.borrowed_qty = 0 AND NEW.damaged_qty > 0 THEN
        SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Damaged' LIMIT 1);
    ELSE
        IF NEW.total_qty > 0 THEN
            SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Available' LIMIT 1);
        ELSE
            SET NEW.status_id = (SELECT status_id FROM equipment_status WHERE status_name = 'Unavailable' LIMIT 1);
        END IF;
    END IF;
END$$

DELIMITER ;