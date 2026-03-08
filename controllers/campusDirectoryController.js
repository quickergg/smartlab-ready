const db = require('../config/db');

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db.query(sql, params, (err, results) => {
    if (err) return reject(err);
    resolve(results);
  });
});

exports.getDirectoryData = async (_req, res) => {
  try {
    const [buildings, rooms, programs, subjects, departments] = await Promise.all([
      query(`
        SELECT b.building_id, b.building_name,
               (SELECT COUNT(*) FROM campus_room r WHERE r.building_id = b.building_id) AS room_count
        FROM campus_building b
        ORDER BY b.building_name
      `),
      query(`
        SELECT r.room_id, r.room_number, r.room_name, r.is_computer_lab, r.building_id, b.building_name
        FROM campus_room r
        LEFT JOIN campus_building b ON b.building_id = r.building_id
        ORDER BY r.room_number
      `),
      query(`
        SELECT program_id, program_code, program_name
        FROM campus_program
        ORDER BY program_code
      `),
      query(`
        SELECT subject_id, subject_code, subject_name
        FROM campus_subject
        ORDER BY subject_code
      `),
      query(`
        SELECT department_id, department_code, department_name
        FROM campus_department
        ORDER BY department_code
      `)
    ]);

    res.json({
      buildings,
      rooms,
      programs,
      subjects,
      departments,
      summary: {
        buildings: buildings.length,
        rooms: rooms.length,
        programs: programs.length,
        subjects: subjects.length,
        departments: departments.length
      }
    });
  } catch (error) {
    console.error('getDirectoryData error:', error);
    res.status(500).json({ message: 'Unable to load academic directory data.' });
  }
};

exports.getPrograms = async (_req, res) => {
  try {
    const programs = await query(`
      SELECT program_id, program_code, program_name
      FROM campus_program
      ORDER BY program_name
    `);
    res.json(programs);
  } catch (error) {
    console.error('getPrograms error:', error);
    res.status(500).json({ message: 'Unable to load programs.' });
  }
};

exports.getRooms = async (_req, res) => {
  try {
    const rooms = await query(`
      SELECT r.room_id, r.room_number, r.room_name, r.is_computer_lab, r.building_id, b.building_name
      FROM campus_room r
      LEFT JOIN campus_building b ON b.building_id = r.building_id
      ORDER BY r.room_number, r.room_name
    `);
    res.json(rooms);
  } catch (error) {
    console.error('getRooms error:', error);
    res.status(500).json({ message: 'Unable to load rooms.' });
  }
};

exports.getSubjects = async (_req, res) => {
  try {
    const subjects = await query(`
      SELECT subject_id, subject_code, subject_name
      FROM campus_subject
      ORDER BY subject_code
    `);
    res.json(subjects);
  } catch (error) {
    console.error('getSubjects error:', error);
    res.status(500).json({ message: 'Unable to load subjects.' });
  }
};

exports.getDepartments = async (_req, res) => {
  try {
    const departments = await query(`
      SELECT department_id, department_code, department_name
      FROM campus_department
      ORDER BY department_name
    `);
    res.json(departments);
  } catch (error) {
    console.error('getDepartments error:', error);
    res.status(500).json({ message: 'Unable to load departments.' });
  }
};

exports.createDepartment = async (req, res) => {
  const code = (req.body?.department_code || '').trim().toUpperCase();
  const name = (req.body?.department_name || '').trim();
  if (!code || !name) {
    return res.status(400).json({ message: 'Department code and name are required.' });
  }
  try {
    const result = await query('INSERT INTO campus_department (department_code, department_name) VALUES (?, ?)', [code, name]);
    res.status(201).json({ department_id: result.insertId, department_code: code, department_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Department code already exists.' });
    }
    console.error('createDepartment error:', error);
    res.status(500).json({ message: 'Unable to save department.' });
  }
};

exports.updateDepartment = async (req, res) => {
  const id = Number(req.params.id);
  const code = (req.body?.department_code || '').trim().toUpperCase();
  const name = (req.body?.department_name || '').trim();
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid department id.' });
  }
  if (!code || !name) {
    return res.status(400).json({ message: 'Department code and name are required.' });
  }
  try {
    const result = await query('UPDATE campus_department SET department_code = ?, department_name = ? WHERE department_id = ?', [code, name, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Department not found.' });
    }
    res.json({ department_id: id, department_code: code, department_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Department code already exists.' });
    }
    console.error('updateDepartment error:', error);
    res.status(500).json({ message: 'Unable to update department.' });
  }
};

exports.createSubject = async (req, res) => {
  const code = (req.body?.subject_code || '').trim().toUpperCase();
  const name = (req.body?.subject_name || '').trim();
  if (!code || !name) {
    return res.status(400).json({ message: 'Subject code and name are required.' });
  }
  try {
    const result = await query('INSERT INTO campus_subject (subject_code, subject_name) VALUES (?, ?)', [code, name]);
    res.status(201).json({ subject_id: result.insertId, subject_code: code, subject_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Subject code already exists.' });
    }
    console.error('createSubject error:', error);
    res.status(500).json({ message: 'Unable to save subject.' });
  }
};

exports.updateSubject = async (req, res) => {
  const id = Number(req.params.id);
  const code = (req.body?.subject_code || '').trim().toUpperCase();
  const name = (req.body?.subject_name || '').trim();
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid subject id.' });
  }
  if (!code || !name) {
    return res.status(400).json({ message: 'Subject code and name are required.' });
  }
  try {
    const result = await query('UPDATE campus_subject SET subject_code = ?, subject_name = ? WHERE subject_id = ?', [code, name, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Subject not found.' });
    }
    res.json({ subject_id: id, subject_code: code, subject_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Subject code already exists.' });
    }
    console.error('updateSubject error:', error);
    res.status(500).json({ message: 'Unable to update subject.' });
  }
};

exports.createProgram = async (req, res) => {
  const code = (req.body?.program_code || '').trim().toUpperCase();
  const name = (req.body?.program_name || '').trim();
  if (!code || !name) {
    return res.status(400).json({ message: 'Program code and name are required.' });
  }
  try {
    const result = await query('INSERT INTO campus_program (program_code, program_name) VALUES (?, ?)', [code, name]);
    res.status(201).json({ program_id: result.insertId, program_code: code, program_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Program code already exists.' });
    }
    console.error('createProgram error:', error);
    res.status(500).json({ message: 'Unable to save program.' });
  }
};

exports.updateProgram = async (req, res) => {
  const id = Number(req.params.id);
  const code = (req.body?.program_code || '').trim().toUpperCase();
  const name = (req.body?.program_name || '').trim();
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid program id.' });
  }
  if (!code || !name) {
    return res.status(400).json({ message: 'Program code and name are required.' });
  }
  try {
    const result = await query('UPDATE campus_program SET program_code = ?, program_name = ? WHERE program_id = ?', [code, name, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Program not found.' });
    }
    res.json({ program_id: id, program_code: code, program_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Program code already exists.' });
    }
    console.error('updateProgram error:', error);
    res.status(500).json({ message: 'Unable to update program.' });
  }
};

exports.createRoom = async (req, res) => {
  const roomNumber = (req.body?.room_number || '').trim();
  const roomName = (req.body?.room_name || '').trim();
  const isComputerLab = req.body?.is_computer_lab ? 1 : 0;
  const buildingIdRaw = req.body?.building_id;
  const buildingId = buildingIdRaw === null || buildingIdRaw === undefined || buildingIdRaw === ''
    ? null
    : Number(buildingIdRaw);

  if (!roomNumber || !roomName) {
    return res.status(400).json({ message: 'Room number and name are required.' });
  }
  if (buildingId !== null && (!Number.isInteger(buildingId) || buildingId <= 0)) {
    return res.status(400).json({ message: 'Invalid building selection.' });
  }

  try {
    const result = await query(
      'INSERT INTO campus_room (building_id, room_number, room_name, is_computer_lab) VALUES (?, ?, ?, ?)',
      [buildingId, roomNumber, roomName, isComputerLab]
    );
    res.status(201).json({
      room_id: result.insertId,
      room_number: roomNumber,
      room_name: roomName,
      building_id: buildingId,
      is_computer_lab: isComputerLab
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Room already exists for this building.' });
    }
    console.error('createRoom error:', error);
    res.status(500).json({ message: 'Unable to save room.' });
  }
};

exports.updateRoom = async (req, res) => {
  const id = Number(req.params.id);
  const roomNumber = (req.body?.room_number || '').trim();
  const roomName = (req.body?.room_name || '').trim();
  const buildingIdRaw = req.body?.building_id;
  const buildingId = buildingIdRaw === null || buildingIdRaw === undefined || buildingIdRaw === ''
    ? null
    : Number(buildingIdRaw);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid room id.' });
  }
  if (!roomNumber || !roomName) {
    return res.status(400).json({ message: 'Room number and name are required.' });
  }
  if (buildingId !== null && (!Number.isInteger(buildingId) || buildingId <= 0)) {
    return res.status(400).json({ message: 'Invalid building selection.' });
  }

  try {
    const result = await query(
      'UPDATE campus_room SET building_id = ?, room_number = ?, room_name = ?, is_computer_lab = ? WHERE room_id = ?',
      [buildingId, roomNumber, roomName, isComputerLab, id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Room not found.' });
    }
    res.json({
      room_id: id,
      room_number: roomNumber,
      room_name: roomName,
      building_id: buildingId,
      is_computer_lab: isComputerLab
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Room already exists for this building.' });
    }
    console.error('updateRoom error:', error);
    res.status(500).json({ message: 'Unable to update room.' });
  }
};

exports.createBuilding = async (req, res) => {
  const name = (req.body?.building_name || '').trim();
  if (!name) {
    return res.status(400).json({ message: 'Building name is required.' });
  }
  try {
    const result = await query('INSERT INTO campus_building (building_name) VALUES (?)', [name]);
    res.status(201).json({ building_id: result.insertId, building_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Building name already exists.' });
    }
    console.error('createBuilding error:', error);
    res.status(500).json({ message: 'Unable to save building.' });
  }
};

exports.updateBuilding = async (req, res) => {
  const id = Number(req.params.id);
  const name = (req.body?.building_name || '').trim();
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid building id.' });
  }
  if (!name) {
    return res.status(400).json({ message: 'Building name is required.' });
  }
  try {
    const result = await query('UPDATE campus_building SET building_name = ? WHERE building_id = ?', [name, id]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Building not found.' });
    }
    res.json({ building_id: id, building_name: name });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Building name already exists.' });
    }
    console.error('updateBuilding error:', error);
    res.status(500).json({ message: 'Unable to update building.' });
  }
};
