document.addEventListener('DOMContentLoaded', function() {
  
  // Faculty form validation
  const facultyDateInput = document.getElementById("dateNeeded");
  const facultyErrorElement = document.getElementById("dateNeeded-error");
  
  if (facultyDateInput && facultyErrorElement) {
    // Set minimum date to 3 days from today (for validation only)
    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3);
    const minDateStr = minDate.toISOString().split('T')[0];
    
    // Set default value to minimum date but don't disable earlier dates
    facultyDateInput.value = minDateStr;
    // Note: NOT setting facultyDateInput.min so users can select earlier dates
    
    console.log("Set default date to:", minDateStr);
    
    // Add simple validation
    facultyDateInput.addEventListener('input', function() {
      console.log("Date input changed to:", this.value);
      
      if (!this.value) {
        facultyErrorElement.textContent = "Date is required.";
        console.log("Date is empty");
        return;
      }
      
      const selectedDate = new Date(this.value);
      const minDateCheck = new Date(minDateStr);
      
      // Clear time part for accurate comparison
      selectedDate.setHours(0, 0, 0, 0);
      minDateCheck.setHours(0, 0, 0, 0);
      
      if (selectedDate < minDateCheck) {
        facultyErrorElement.textContent = "Requests must be filed at least 3 working days in advance.";
        console.log("Date is too early");
      } else {
        facultyErrorElement.textContent = "";
        console.log("Date is valid");
      }
    });
    
    // Also validate on blur
    facultyDateInput.addEventListener('blur', function() {
      if (!this.value) {
        facultyErrorElement.textContent = "Date is required.";
        return;
      }
      
      const selectedDate = new Date(this.value);
      const minDateCheck = new Date(minDateStr);
      
      selectedDate.setHours(0, 0, 0, 0);
      minDateCheck.setHours(0, 0, 0, 0);
      
      if (selectedDate < minDateCheck) {
        facultyErrorElement.textContent = "Requests must be filed at least 3 working days in advance.";
      } else {
        facultyErrorElement.textContent = "";
      }
    });
  }
  
  // Time validation for faculty form
  const facultyTimeStartInput = document.getElementById("timeStart");
  const facultyTimeEndInput = document.getElementById("timeEnd");
  const facultyTimeStartError = document.getElementById("timeStart-error");
  const facultyTimeEndError = document.getElementById("timeEnd-error");
  
  if (facultyTimeStartInput && facultyTimeEndInput && facultyTimeStartError && facultyTimeEndError) {
    
    function validateFacultyTimeRange() {
      const startTime = facultyTimeStartInput.value;
      const endTime = facultyTimeEndInput.value;
      
      // Clear previous errors
      facultyTimeStartError.textContent = "";
      facultyTimeEndError.textContent = "";
      
      // Validate start time
      if (!startTime) {
        facultyTimeStartError.textContent = "Start time is required.";
        return false;
      }
      
      // Validate end time
      if (!endTime) {
        facultyTimeEndError.textContent = "End time is required.";
        return false;
      }
      
      // Define allowed time slots (30-minute intervals from 07:30 to 21:00)
      const allowedTimes = [
        '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
        '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
      ];

      // Convert times to HH:MM format for comparison
      const startTimeHHMM = startTime.substring(0, 5);
      const endTimeHHMM = endTime.substring(0, 5);

      // Validate start time is in allowed slots
      if (!allowedTimes.includes(startTimeHHMM)) {
        facultyTimeStartError.textContent = `Time must be one of the following: ${allowedTimes.join(', ')}`;
        return false;
      }

      // Validate end time is in allowed slots
      if (!allowedTimes.includes(endTimeHHMM)) {
        facultyTimeEndError.textContent = `Time must be one of the following: ${allowedTimes.join(', ')}`;
        return false;
      }
      
      // Convert to minutes for comparison
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      // End time must be after start time
      if (endMinutes <= startMinutes) {
        facultyTimeEndError.textContent = "End time must be after start time.";
        return false;
      }
      
      // Minimum duration (30 minutes)
      const durationMinutes = endMinutes - startMinutes;
      if (durationMinutes < 30) {
        facultyTimeEndError.textContent = "Duration must be at least 30 minutes.";
        return false;
      }
      
      return true;
    }
    
    function timeToMinutes(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    }
    
    // Add event listeners
    facultyTimeStartInput.addEventListener('input', function() {
      console.log("Start time changed to:", this.value);
      validateFacultyTimeRange();
    });
    
    facultyTimeStartInput.addEventListener('blur', validateFacultyTimeRange);
    
    facultyTimeEndInput.addEventListener('input', function() {
      console.log("End time changed to:", this.value);
      validateFacultyTimeRange();
    });
    
    facultyTimeEndInput.addEventListener('blur', validateFacultyTimeRange);
    
  } else {
  }
  
  // Student form validation
  const studentDateInput = document.getElementById("dateNeeded");
  const studentErrorElement = document.getElementById("dateNeeded-error");
  const studentTimeStartInput = document.getElementById("timeStart");
  const studentTimeEndInput = document.getElementById("timeEnd");
  const studentTimeStartError = document.getElementById("timeStart-error");
  const studentTimeEndError = document.getElementById("timeEnd-error");
  
  // Check if we're on student page (faculty elements might also exist)
  const isStudentPage = document.getElementById("studentRequestForm");
  
  if (isStudentPage && studentDateInput && studentErrorElement) {
    console.log("Setting up student date validation");
    
    // Set minimum date to 3 working days from today
    function setStudentMinDate() {
      const today = new Date();
      const minDate = new Date(today);
      let daysAdded = 0;
      
      // Add 3 working days (skip weekends)
      while (daysAdded < 3) {
        minDate.setDate(minDate.getDate() + 1);
        // Skip weekends (Saturday = 6, Sunday = 0)
        if (minDate.getDay() !== 0 && minDate.getDay() !== 6) {
          daysAdded++;
        }
      }
      
      const minDateStr = minDate.toISOString().split('T')[0];
      studentDateInput.min = minDateStr;
      studentDateInput.value = minDateStr; // Set default value
      console.log("Student minimum date set to:", minDateStr);
      return minDateStr;
    }
    
    // Set minimum date on page load
    const studentMinDateStr = setStudentMinDate();
    
    // Student date validation function
    function validateStudentDate() {
      if (!studentDateInput.value) {
        studentErrorElement.textContent = "Date is required.";
        return false;
      }
      
      const selectedDate = new Date(studentDateInput.value);
      const minDateCheck = new Date(studentMinDateStr);
      
      // Clear time part for accurate comparison
      selectedDate.setHours(0, 0, 0, 0);
      minDateCheck.setHours(0, 0, 0, 0);
      
      if (selectedDate < minDateCheck) {
        studentErrorElement.textContent = "Requests must be filed at least 3 working days in advance.";
        return false;
      } else {
        studentErrorElement.textContent = "";
        return true;
      }
    }
    
    // Add event listeners for student date
    studentDateInput.addEventListener('input', function() {
      console.log("Student date changed to:", this.value);
      validateStudentDate();
    });
    
    studentDateInput.addEventListener('blur', validateStudentDate);
    studentDateInput.addEventListener('change', validateStudentDate);
  }
  
  // Student time validation
  if (isStudentPage && studentTimeStartInput && studentTimeEndInput && studentTimeStartError && studentTimeEndError) {
    console.log("Setting up student time validation");
    
    function validateStudentTimeRange() {
      const startTime = studentTimeStartInput.value;
      const endTime = studentTimeEndInput.value;
      
      // Clear previous errors
      studentTimeStartError.textContent = "";
      studentTimeEndError.textContent = "";
      
      // Validate start time
      if (!startTime) {
        studentTimeStartError.textContent = "Start time is required.";
        return false;
      }
      
      // Validate end time
      if (!endTime) {
        studentTimeEndError.textContent = "End time is required.";
        return false;
      }
      
      // Define allowed time slots (30-minute intervals from 07:30 to 21:00)
      const allowedTimes = [
        '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
        '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
      ];

      // Convert times to HH:MM format for comparison
      const startTimeHHMM = startTime.substring(0, 5);
      const endTimeHHMM = endTime.substring(0, 5);

      // Validate start time is in allowed slots
      if (!allowedTimes.includes(startTimeHHMM)) {
        studentTimeStartError.textContent = `Time must be one of the following: ${allowedTimes.join(', ')}`;
        return false;
      }

      // Validate end time is in allowed slots
      if (!allowedTimes.includes(endTimeHHMM)) {
        studentTimeEndError.textContent = `Time must be one of the following: ${allowedTimes.join(', ')}`;
        return false;
      }
      
      // Convert to minutes for comparison
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      
      // End time must be after start time
      if (endMinutes <= startMinutes) {
        studentTimeEndError.textContent = "End time must be after start time.";
        return false;
      }
      
      // Minimum duration (30 minutes)
      const durationMinutes = endMinutes - startMinutes;
      if (durationMinutes < 30) {
        studentTimeEndError.textContent = "Duration must be at least 30 minutes.";
        return false;
      }
      
      return true;
    }
    
    function timeToMinutes(timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    }
    
    // Add event listeners for student time
    studentTimeStartInput.addEventListener('input', function() {
      console.log("Student start time changed to:", this.value);
      validateStudentTimeRange();
    });
    
    studentTimeStartInput.addEventListener('blur', validateStudentTimeRange);
    
    studentTimeEndInput.addEventListener('input', function() {
      console.log("Student end time changed to:", this.value);
      validateStudentTimeRange();
    });
    
    studentTimeEndInput.addEventListener('blur', validateStudentTimeRange);
  }
  
  // Lab schedule conflict detection for faculty form
  const labCheckbox = document.getElementById("labChk");
  const labSelect = document.getElementById("labSelect");
  const locationInput = document.getElementById("location");
  
  let allSchedules = [];
  
  // Load existing schedules
  async function loadLabSchedules() {
    try {
      const res = await fetch("/api/labSchedule");
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || "Failed to load schedules");
      
      allSchedules = Array.isArray(data) ? data : [];
    } catch (err) {
      allSchedules = [];
    }
  }
  
  // Convert time string to minutes (24-hour format)
  function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  // Get day of week from date
  function getDayOfWeek(dateStr) {
    const date = new Date(dateStr);
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[date.getDay()];
  }
  
  // Check for lab schedule conflicts
  function checkLabScheduleConflict() {
    // Only check if lab is selected
    if (!labCheckbox?.checked || !labSelect?.value || !facultyDateInput?.value || !facultyTimeStartInput?.value || !facultyTimeEndInput?.value) {
      return null; // No conflict check needed
    }
    
    const selectedLab = labSelect.value;
    const selectedDate = facultyDateInput.value;
    const selectedDay = getDayOfWeek(selectedDate);
    const startTime = facultyTimeStartInput.value;
    const endTime = facultyTimeEndInput.value;
    
    console.log("Checking lab conflict:", {
      lab: selectedLab,
      date: selectedDate,
      day: selectedDay,
      time: `${startTime} - ${endTime}`
    });
    
    // Find conflicting schedule
    const conflict = allSchedules.find(existing => {
      // Check same lab
      if (existing.lab_room !== selectedLab) return false;
      
      // Check same day
      if (existing.day_of_week !== selectedDay) return false;
      
      // Check time overlap
      const existingStart = timeToMinutes(existing.time_start);
      const existingEnd = timeToMinutes(existing.time_end);
      const newStart = timeToMinutes(startTime);
      const newEnd = timeToMinutes(endTime);
      
      const hasTimeOverlap = (newStart < existingEnd && newEnd > existingStart);
      
      if (hasTimeOverlap) {
        console.log("Conflict found:", existing);
      }
      
      return hasTimeOverlap;
    });
    
    return conflict || null;
  }
  
  // Validate lab schedule conflicts
  function validateLabSchedule() {
    if (!labCheckbox?.checked) {
      return ""; // No lab selected, no conflict needed
    }
    
    const conflict = checkLabScheduleConflict();
    
    if (conflict) {
      return `Lab schedule conflict! ${conflict.lab_room} is already booked on ${conflict.day_of_week} from ${conflict.time_start} to ${conflict.time_end} for ${conflict.subject}.`;
    }
    
    return ""; // No conflict
  }
  
  // Add lab schedule validation
  if (labCheckbox && labSelect && facultyDateInput && facultyTimeStartInput && facultyTimeEndInput) {
    console.log("Setting up lab schedule conflict detection");
    
    // Load schedules on page load
    loadLabSchedules();
    
    // Create error element for lab conflicts
    const labConflictError = document.createElement("small");
    labConflictError.id = "lab-conflict-error";
    labConflictError.className = "error";
    labConflictError.style.cssText = "color: red; font-size: 12px; margin-top: 4px; display: block;";
    
    // Insert error element after lab selection
    labSelect.parentNode.parentNode.appendChild(labConflictError);
    
    // Function to check and display conflicts
    function checkAndDisplayConflict() {
      const error = validateLabSchedule();
      labConflictError.textContent = error;
      
      console.log("Lab conflict check result:", error || "No conflict");
    }
    
    // Add event listeners for conflict detection
    labCheckbox.addEventListener('change', checkAndDisplayConflict);
    labSelect.addEventListener('change', checkAndDisplayConflict);
    facultyDateInput.addEventListener('input', checkAndDisplayConflict);
    facultyDateInput.addEventListener('blur', checkAndDisplayConflict);
    facultyTimeStartInput.addEventListener('input', function() {
      validateFacultyTimeRange(); // Existing time validation
      checkAndDisplayConflict(); // Lab conflict validation
    });
    facultyTimeEndInput.addEventListener('input', function() {
      validateFacultyTimeRange(); // Existing time validation
      checkAndDisplayConflict(); // Lab conflict validation
    });
  }
});

// Admin panel schedule validation code (restored)
const timeStartInput = document.getElementById("sched-start");
const timeStartErrorBox = document.getElementById("time-start-error");
const timeEndInput = document.getElementById("sched-end");
const timeEndErrorBox = document.getElementById("time-end-error");

// Equipment quantity validation
const editTotalQtyInput = document.getElementById("edit-total-qty");
const editAvailableQtyInput = document.getElementById("edit-available-qty");
const editTotalQtyErrorBox = document.getElementById("edit-total-qty-error");

// Faculty date validation (admin panel)
const dateNeededInput = document.getElementById("dateNeeded");
const dateNeededErrorBox = document.getElementById("dateNeeded-error");


function validateTimeRange(time) {
    if (!time) {
        return "Time is required.";
    }

    // Define allowed time slots (30-minute intervals from 07:30 to 21:00)
    const allowedTimes = [
        '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
        '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
    ];

    // Convert time to HH:MM format for comparison
    const timeHHMM = time.substring(0, 5);

    if (!allowedTimes.includes(timeHHMM)) {
        return `Time must be one of the following: ${allowedTimes.join(', ')}`;
    }

    return "";
}

function validateDateNeeded(date) {
  if (!date) {
    return "Date is required.";
  }

  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  
  // Calculate minimum date (3 days from today)
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 3);
  
  // Clear time part for accurate date comparison
  selectedDate.setHours(0, 0, 0, 0);
  minDate.setHours(0, 0, 0, 0);
  
  if (selectedDate < minDate) {
    const daysDiff = Math.ceil((minDate - today) / (1000 * 60 * 60 * 24));
    return `Requests must be filed at least ${daysDiff} working days in advance.`;
  }

  return "";
}

function validateEquipmentQuantity(totalQty, availableQty, borrowedQty = 0, damagedQty = 0) {
  if (!totalQty || totalQty === "") {
    return "Total quantity is required.";
  }
   
  const total = parseInt(totalQty);
  const available = parseInt(availableQty) || 0;
  const borrowed = parseInt(borrowedQty) || 0;
  const damaged = parseInt(damagedQty) || 0;
  const minRequired = borrowed + damaged;
  
  if (isNaN(total) || total < 0) {
    return "Total quantity must be a valid number greater than or equal to 0.";
  }
  
  if (total < minRequired) {
    let message = `You can't go below ${minRequired} because `;
    const reasons = [];
    
    if (borrowed > 0) {
      reasons.push(`${borrowed} equipment${borrowed > 1 ? 's are' : ' is'} currently borrowed`);
    }
    
    if (damaged > 0) {
      reasons.push(`${damaged} equipment${damaged > 1 ? 's are' : ' is'} currently damaged`);
    }
    
    message += reasons.join(' and ') + '.';
    return message;
  }
  
  return "";
}


// On update textfield live typing
timeStartInput?.addEventListener("input", () => {
    timeStartErrorBox.textContent = validateTimeRange(timeStartInput.value);
});

timeEndInput?.addEventListener("input", () => {
    timeEndErrorBox.textContent = validateTimeRange(timeEndInput.value);
});

//On update textfield when user leaves the field
timeStartInput?.addEventListener("blur", () => {
    timeStartErrorBox.textContent = validateTimeRange(timeStartInput.value);
});

timeEndInput?.addEventListener("blur", () => {
    timeEndErrorBox.textContent = validateTimeRange(timeEndInput.value);
});

// Faculty date validation event listeners
if (dateNeededInput && dateNeededErrorBox) {
  console.log("Date validation elements found:", {
    dateNeededInput: dateNeededInput.id,
    dateNeededErrorBox: dateNeededErrorBox.id
  });
  
  // Set minimum date to 3 days from today
  function setMinDate() {
    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3);
    
    // Format as YYYY-MM-DD for input field
    const minDateStr = minDate.toISOString().split('T')[0];
    dateNeededInput.min = minDateStr;
    console.log("Set minimum date to:", minDateStr);
  }
  
  // Set minimum date on page load
  setMinDate();
  
  // Validate on change event (after field is updated)
  dateNeededInput.addEventListener("change", () => {
    console.log("Date changed to:", dateNeededInput.value);
    const errorMessage = validateDateNeeded(dateNeededInput.value);
    dateNeededErrorBox.textContent = errorMessage;
    console.log("Validation result:", errorMessage);
  });
  
  // Also validate on blur for additional feedback
  dateNeededInput.addEventListener("blur", () => {
    console.log("Date blur event:", dateNeededInput.value);
    const errorMessage = validateDateNeeded(dateNeededInput.value);
    dateNeededErrorBox.textContent = errorMessage;
  });
  
  // Set default value to minimum date
  dateNeededInput.value = dateNeededInput.min;
  console.log("Set default date to:", dateNeededInput.value);
}

// Equipment quantity validation event listeners
if (editTotalQtyInput && editAvailableQtyInput && editTotalQtyErrorBox) {
  let currentBorrowedQty = 0;
  let currentDamagedQty = 0;
  
  editTotalQtyInput.addEventListener("input", () => {
    const errorMessage = validateEquipmentQuantity(
      editTotalQtyInput.value, 
      editAvailableQtyInput.value, 
      currentBorrowedQty, 
      currentDamagedQty
    );
    editTotalQtyErrorBox.textContent = errorMessage;
  });

  editTotalQtyInput.addEventListener("blur", () => {
    const errorMessage = validateEquipmentQuantity(
      editTotalQtyInput.value, 
      editAvailableQtyInput.value, 
      currentBorrowedQty, 
      currentDamagedQty
    );
    editTotalQtyErrorBox.textContent = errorMessage;
  });

  // Function to update borrowed and damaged quantities when modal opens
  window.updateEquipmentValidationData = function(borrowedQty, damagedQty) {
    currentBorrowedQty = borrowedQty || 0;
    currentDamagedQty = damagedQty || 0;
    
    // Re-validate when data is updated
    const errorMessage = validateEquipmentQuantity(
      editTotalQtyInput.value, 
      editAvailableQtyInput.value, 
      currentBorrowedQty, 
      currentDamagedQty
    );
    editTotalQtyErrorBox.textContent = errorMessage;
  };
}
