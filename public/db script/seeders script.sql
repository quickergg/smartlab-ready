-- Insert data into academic_year table
INSERT INTO academic_year (academic_year, is_active) VALUES
('2025-2026', TRUE),
('2026-2027', FALSE);

-- Insert data into term table
INSERT INTO term (term, is_active) VALUES
('1st Semester', TRUE),
('2nd Semester', FALSE),
('Summer', FALSE);

-- Insert data into campus_building table
INSERT INTO campus_building (building_name) VALUES
('Nantes Building'),
('Education Building'),
('Health & Science Building'),
('Engineering and Architecture Building'),
('Grandstand'),
('Gymnasium'),
('Admin Building');

-- Insert data into campus_room table
INSERT INTO campus_room (building_id, room_number, room_name, is_computer_lab) VALUES
(NULL, '101', 'Computer Laboratory 1', 1),
(NULL, '102', 'Computer Laboratory 2', 1),
(NULL, '207', 'Computer Laboratory 3', 1),
(2, '201', 'Education Lecture Hall 201', 0),
(3, '305', 'Nursing Skills Laboratory', 0),
(4, '401', 'Engineering CAD Studio', 0),
(6, '', 'Gymnasium Main Floor', 0);

-- Insert data into campus_program table
INSERT INTO campus_program (program_code, program_name) VALUES
('BSIT', 'Bachelor of Science in Information Technology'),
('BSCS', 'Bachelor of Science in Computer Science'),
('BSEE', 'Bachelor of Science in Electronics Engineering'),
('BSN', 'Bachelor of Science in Nursing'),
('DIT', 'Diploma in Information Technology');

-- Insert data into campus_subject table
INSERT INTO campus_subject (subject_code, subject_name) VALUES
('IT101', 'Introduction to Information Technology'),
('CS201', 'Data Structures and Algorithms'),
('EE210', 'Circuit Analysis'),
('NRS110', 'Fundamentals of Nursing'),
('IT305', 'Software Engineering'),
('IT210', 'Database Systems'),
('EE215', 'Electronics Laboratory'),
('IT115', 'Introduction to Programming');

-- Insert data into campus_department table
INSERT INTO campus_department (department_code, department_name) VALUES
('CS', 'Computer Science Department'),
('ENG', 'Engineering Department'),
('EDU', 'Education Department'),
('NRS', 'Nursing Department'),
('IT', 'Information Technology Department');

-- Insert data into user status table
INSERT INTO user_status (status_name) VALUES
('Active'),
('Deactivated');

-- Insert data into user role table
INSERT INTO user_role (role_name) VALUES
('Admin'),
('Faculty'),
('Student');

-- Insert data into user table
INSERT INTO user (gmail, password_hash, role_id, status_id, created_at, updated_at)
VALUES
-- Admin Users
('admin@smartlab.com', 'admin123', 1, 1, NOW(), NOW()),

-- Faculty Users
('Sean@smartlab.com', 'sean123', 2, 1, NOW(), NOW()),
('Conrad@smartlab.com', 'conrad123', 2, 1, NOW(), NOW()),
('Leigh@smartlab.com', 'leigh123', 2, 1, NOW(), NOW()),

-- Student Users
('Kendrick@smartlab.com', 'kendrick123', 3, 1, NOW(), NOW()),
('Krizzia@smartlab.com', 'krizzia123', 3, 1, NOW(), NOW()),
('Jehanne@smartlab.com', 'jehanne123', 3, 1, NOW(), NOW());

-- Seed faculty profiles with department assignments (referencing campus_department IDs)
INSERT INTO faculty_profile (faculty_id, full_name, department_id)
VALUES
(2, 'Sean Salabo', 1),
(3, 'Conrad Oriarte', 2),
(4, 'Leigh Torres', 5);

-- Insert into admin_profile table
INSERT INTO admin_profile (admin_id, full_name)
VALUES
(1, 'Admin');

-- Insert into student_profile table
INSERT INTO student_profile (student_id, full_name, program_id, year_level)
VALUES
(5, 'Kendrick Macalinao', 1, 3),
(6, 'Krizzia Yabut', 3, 2),
(7, 'Jehanne Marcaida', 5, 1);

-- Insert data into lab_schedule table
-- schedule_date = NULL → recurring weekly, schedule_date = DATE → one-time
-- borrow_request_id = NULL → manually created, borrow_request_id = INT → auto-created from approved request
INSERT INTO lab_schedule 
(room_id, faculty_id, program_id, year_level, subject_id, day_of_week, schedule_date, borrow_request_id, time_start, time_end, academic_year_id, term_id, created_by, created_at)
VALUES
-- Recurring weekly schedules (schedule_date = NULL)
(1, 2, 1, 3, 6, 'MONDAY', NULL, NULL, '08:00:00', '10:00:00', 1, 1, 1, NOW()),
(2, 3, 2, 2, 2, 'TUESDAY', NULL, NULL, '09:00:00', '11:00:00', 1, 1, 1, NOW()),
(1, 2, 1, 4, 5, 'WEDNESDAY', NULL, NULL, '10:00:00', '12:00:00', 1, 1, 1, NOW()),
(3, 4, 3, 3, 7, 'THURSDAY', NULL, NULL, '08:30:00', '10:30:00', 1, 1, 1, NOW()),
(2, 3, 2, 1, 8, 'FRIDAY', NULL, NULL, '13:00:00', '15:00:00', 1, 1, 1, NOW());

-- Insert into equipment status table
INSERT INTO equipment_status (status_name)
VALUES
('Available'),
('Borrowed'),
('Damaged'),
('Unavailable');

-- Insert into equipment table
INSERT INTO equipment (equipment_name, status_id, total_qty, available_qty, borrowed_qty, damaged_qty, created_at, updated_at)
VALUES
('LCD/LED TV', 1, 4, 0, 0, 0, NOW(), NOW()),
('VGA/HDMI port', 1, 3, 0, 0, 0, NOW(), NOW()),
('Extension Cords', 1, 2, 0, 0, 0, NOW(), NOW()),
('Projectors', 1, 2, 0, 0, 0, NOW(), NOW()),
('Crimping tool', 1, 5, 0, 0, 0, NOW(), NOW());

-- Insert into borrow_request_status table
INSERT INTO borrow_request_status (status_name)
VALUES
('Pending'),
('Approved'),
('Declined'),
('Cancelled'),
('Returned'),
('Borrowed');

-- Insert into borrow_request table
INSERT INTO borrow_request
(requested_by, lab_schedule_id, faculty_id, subject_id, program_id, year_level, date_needed, room_id, time_start, time_end, contact_details, purpose, note, status_id, academic_year_id, term_id, reviewed_by, reviewed_at, approved_at, borrowed_at, returned_at, cancelled_at, declined_at, created_at)
VALUES
-- Borrow request 1: Student borrowing a lab (pending)
(5, 1, NULL, NULL, 1, 3, '2026-02-01', 1, '08:00:00', '10:00:00', '09171234567', 'Database exercise', NULL, 1, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
-- Borrow request 2: Student borrowing equipment (pending)
(6, NULL, NULL, NULL, 3, 2, '2026-02-02', 2, '10:00:00', '11:00:00', '09171234568', 'Presentation', NULL, 1, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
-- Borrow request 3: Faculty borrowing lab for class (approved/borrowed)
(2, 2, 2, NULL, 2, 2, '2026-02-03', 3, '09:00:00', '11:00:00', '09171234569', 'Lab lecture', NULL, 2, 1, 1, 1, NOW(), NOW(), NOW(), NULL, NULL, NULL, NOW()),
-- Borrow request 4: Student borrowing multiple equipment (pending)
(7, NULL, NULL, NULL, 5, 1, '2026-02-04', 1, '11:00:00', '13:00:00', '09171234570', 'Group project', NULL, 1, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
-- Borrow request 5: Faculty borrowing lab (pending)
(3, 3, 3, NULL, 2, 1, '2026-02-05', 3, '13:00:00', '15:00:00', '09171234571', 'Physics experiments', NULL, 1, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
-- Borrow request 6: Student with faculty supervisor (pending)
(5, NULL, 2, NULL, 1, 3, '2026-02-06', 2, '14:00:00', '16:00:00', '09171234572', 'Capstone development', NULL, 1, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
-- Borrow request 7: Declined request
(6, NULL, NULL, NULL, 3, 2, '2026-02-07', 1, '09:00:00', '10:00:00', '09171234573', 'Testing equipment', 'Insufficient justification', 3, 1, 1, 1, NOW(), NOW(), NULL, NULL, NULL, NULL, NOW()),
-- Borrow request 8: Cancelled request
(7, NULL, NULL, NULL, 5, 1, '2026-02-08', 3, '15:00:00', '17:00:00', '09171234574', 'Skill practice', NULL, 4, 1, 1, NULL, NULL, NULL, NULL, NULL, NOW(), NULL, NOW()),
-- Borrow request 9: Returned request
(5, NULL, 4, NULL, 1, 3, '2026-01-25', 1, '08:00:00', '10:00:00', '09171234575', 'Final defense presentation', NULL, 5, 1, 1, 1, NOW(), NOW(), NOW(), NOW(), NULL, NULL, NOW()),
-- Borrow request 10: Pending faculty request
(3, NULL, 3, NULL, 2, 1, '2026-02-10', 2, '16:00:00', '18:00:00', '09171234576', 'AI research project', NULL, 1, 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW());

-- Insert into borrow_request_item table
INSERT INTO borrow_request_item (borrow_request_id, equipment_id, quantity)
VALUES
-- borrow_request_id 2 uses equipment 1 and 2
(2, 1, 1),
(2, 2, 2),
-- borrow_request_id 4 uses equipment 3, 4, 5
(4, 3, 2),
(4, 4, 1),
(4, 5, 3),
-- borrow_request_id 6 uses equipment 1
(6, 1, 1),
-- borrow_request_id 7 uses equipment 2
(7, 2, 1),
-- borrow_request_id 9 uses equipment 3 and 4
(9, 3, 1),
(9, 4, 1),
-- borrow_request_id 10 uses equipment 5
(10, 5, 2);

-- Insert one-time lab schedules (created from approved borrow requests with lab rooms)
-- These must come after borrow_request inserts due to FK constraint
INSERT INTO lab_schedule
(room_id, faculty_id, program_id, year_level, subject_id, day_of_week, schedule_date, borrow_request_id, time_start, time_end, academic_year_id, term_id, created_by, created_at)
VALUES
-- One-time schedule from approved borrow request #3 (faculty_id=2, Lab 3, 2026-02-03 is a Tuesday)
(3, 2, 2, 2, 7, 'TUESDAY', '2026-02-03', 3, '09:00:00', '11:00:00', 1, 1, 1, NOW());

-- Insert into audit_log table
INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, details, created_at)
VALUES
(1, 'Approved borrow request', 'Borrow Request', 3, '{"note":"Approved by admin"}', NOW()),
(1, 'Declined borrow request', 'Borrow Request', 7, '{"note":"Insufficient justification"}', NOW()),
(1, 'Cancelled borrow request', 'Borrow Request', 8, '{"note":"Cancelled by user"}', NOW()),
(1, 'Returned borrow request', 'Borrow Request', 9, '{"note":"Equipment returned successfully"}', NOW());