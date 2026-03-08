(function () {
    const root = window.SmartLab = window.SmartLab || {};
    root.Core = root.Core || {};
    root.Core.Templates = root.Core.Templates || {};

    const DEFAULT_CONFIGS = {
        student: {
            role: 'student',
            formId: 'studentRequestForm',
            headerTitle: 'New Borrow Request',
            newRequestButtonId: 'newRequestBtn',
            includeLabToggle: false,
            programSelectName: 'program_id',
            programHelperText: '',
            programDisabled: true,
            yearSelectDisabled: true,
            locationLabel: 'Laboratory / Room',
            locationSelectName: 'room_id',
            includeLocationCustom: false,
            contactInputAttributes: '',
            submitButtonId: 'submitRequestBtn'
        },
        faculty: {
            role: 'faculty',
            formId: 'facultyRequestForm',
            headerTitle: 'New Borrow Request',
            newRequestButtonId: 'newRequestBtn',
            includeLabToggle: true,
            programSelectName: 'program',
            programDisabled: false,
            yearSelectDisabled: false,
            locationLabel: 'Location',
            locationSelectName: 'location',
            includeLocationCustom: true,
            contactInputAttributes: 'inputmode="email"',
            submitButtonId: 'submitRequestBtn'
        }
    };

    function buildLabToggleSection(cfg) {
        if (!cfg.includeLabToggle) return '';
        return `
            <!-- Row 4: Lab Checkbox & Lab Select -->
            <div class="form-row">
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="labChk" />
                        Use Laboratory Room
                    </label>
                    <div id="labSelectWrap" class="hidden" style="margin-top:8px;">
                        <select id="labSelect" name="lab_room">
                            <option value="">Loading lab rooms...</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="location">${cfg.locationLabel}</label>
                    <select id="location" name="${cfg.locationSelectName}" data-validate="required">
                        <option value="">Loading rooms...</option>
                    </select>
                    ${cfg.includeLocationCustom ? `
                        <div id="locationCustomWrap" class="hidden" style="margin-top:10px;">
                            <label for="locationCustom" style="font-size:0.85rem;color:#6b7280;margin-bottom:4px;display:block;">Custom location</label>
                            <input type="text" id="locationCustom" name="location_custom" class="form-input" placeholder="Enter room or venue" disabled>
                        </div>
                    ` : '<small class="form-error" data-error="location"></small>'}
                </div>
            </div>
        `;
    }

    function buildLocationRow(cfg) {
        if (cfg.includeLabToggle) return '';
        const customInput = cfg.includeLocationCustom ? `
            <div id="locationCustomWrap" class="hidden" style="margin-top:10px;">
                <label for="locationCustom" style="font-size:0.85rem;color:#6b7280;margin-bottom:4px;display:block;">Custom location</label>
                <input type="text" id="locationCustom" name="location_custom" class="form-input" placeholder="Enter room or venue" disabled>
            </div>
        ` : '<small class="form-error" data-error="location"></small>';
        return `
            <!-- Row 3: Date Needed & Location -->
            <div class="form-row">
                <div class="form-group">
                    <label for="dateNeeded">Date Needed</label>
                    <input type="date" id="dateNeeded" name="date_needed" required data-validate="required|date|date-advance:2" />
                    <small class="form-error" data-error="dateNeeded"></small>
                </div>
                <div class="form-group">
                    <label for="location">${cfg.locationLabel}</label>
                    <select id="location" name="${cfg.locationSelectName}" required data-validate="required">
                        <option value="">Loading rooms...</option>
                    </select>
                    ${customInput}
                </div>
            </div>
        `;
    }

    function buildDateRow() {
        return `
            <!-- Row 3: Date Needed -->
            <div class="form-row">
                <div class="form-group">
                    <label for="dateNeeded">Date Needed</label>
                    <input type="date" id="dateNeeded" name="date_needed" required data-validate="required|date|date-advance:2" />
                    <small class="form-error" data-error="dateNeeded"></small>
                </div>
            </div>
        `;
    }

    function buildTemplate(config) {
        const programDisabledAttr = config.programDisabled ? 'disabled' : '';
        const yearDisabledAttr = config.yearSelectDisabled ? 'disabled' : '';
        const locationRow = buildLocationRow(config);
        const labSection = buildLabToggleSection(config);
        const dateRowForLab = config.includeLabToggle ? buildDateRow() : '';
        const labSectionBeforeTime = config.includeLabToggle ? labSection : '';
        const labSectionAfterTime = config.includeLabToggle ? '' : labSection;
        return `
            <div class="card">
                <div class="cardHeader">
                    <h3>${config.headerTitle}</h3>
                    <div class="header-actions">
                        <button type="button" class="btn btn-secondary" id="${config.newRequestButtonId}">New Request</button>
                    </div>
                </div>

                <form id="${config.formId}" autocomplete="off" data-validate>
                    <!-- Row 1: Subject & Faculty -->
                    <div class="form-row">
                        <div class="form-group">
                            <label for="subject-select">Subject</label>
                            <select id="subject-select" name="subject_id" required data-validate="required">
                                <option value="">Loading subjects...</option>
                            </select>
                            <small class="form-error" data-error="subject"></small>
                        </div>
                        <div class="form-group">
                            <label for="facultyIdSelect">Faculty in Charge</label>
                            <select id="facultyIdSelect" name="faculty_id">
                                <option value="">-- Select Faculty --</option>
                            </select>
                        </div>
                    </div>

                    <!-- Row 2: Program & Year Level -->
                    <div class="form-row">
                        <div class="form-group">
                            <label for="program-select">Program</label>
                            <select id="program-select" name="${config.programSelectName}" required ${programDisabledAttr}>
                                <option value="">Loading programs...</option>
                            </select>
                            ${config.programHelperText ? `<small class="form-help">${config.programHelperText}</small>` : ''}
                        </div>
                        <div class="form-group">
                            <label for="year-select">Year Level</label>
                            <select id="year-select" name="year_level" required ${yearDisabledAttr}>
                                <option value="">Select Year</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                                <option value="5">5th Year</option>
                            </select>
                        </div>
                    </div>

                    ${locationRow}

                    ${dateRowForLab}

                    ${labSectionBeforeTime}

                    <!-- Row 4: Time -->
                    <div class="form-row time-row">
                        <div class="time-column">
                            <div class="form-group">
                                <label for="timeStart">Time Start</label>
                                <select id="timeStart" name="time_start" required data-validate="required|time-slot" data-time-select data-placeholder="Select start time">
                                    <option value="">Loading slots...</option>
                                </select>
                                <small class="form-error" data-error="timeStart"></small>
                            </div>
                            <div class="time-validation-card conflict-loading" data-time-card="start">
                                <div class="time-validation-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12,6 12,12 16,14"></polyline>
                                    </svg>
                                </div>
                                <div>
                                    <div class="time-validation-title">Start Time</div>
                                    <div class="time-validation-message">Select a start time between 7:30 AM and 9:00 PM.</div>
                                </div>
                            </div>
                        </div>
                        <div class="time-column">
                            <div class="form-group">
                                <label for="timeEnd">Time End</label>
                                <select id="timeEnd" name="time_end" required data-validate="required|time-slot" data-time-select data-placeholder="Select end time">
                                    <option value="">Loading slots...</option>
                                </select>
                                <small class="form-error" data-error="timeEnd"></small>
                            </div>
                            <div class="time-validation-card conflict-loading" data-time-card="end">
                                <div class="time-validation-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12,6 12,12 16,14"></polyline>
                                    </svg>
                                </div>
                                <div>
                                    <div class="time-validation-title">End Time</div>
                                    <div class="time-validation-message">Select an end time at least 30 minutes after the start.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${labSectionAfterTime}

                    <!-- Conflict Detection Display -->
                    <div id="conflict-display" class="conflict-container" style="display:none;"></div>

                    <!-- Equipment Selection -->
                    <div class="form-group">
                        <label>Equipment Needed</label>
                        <div class="equipment-availability-label" aria-live="polite">
                            <span class="equipment-availability-icon" aria-hidden="true">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                            </span>
                            <span class="equipment-availability-text" id="equipment-availability-text">
                                Available equipment (select a date to see daily availability)
                            </span>
                        </div>
                        <div id="equipment-container" style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;max-height:300px;overflow-y:auto;">
                            <div style="text-align:center;color:#999;padding:20px;">Loading equipment...</div>
                        </div>
                    </div>

                    <!-- Purpose -->
                    <div class="form-group">
                        <label for="purpose">Purpose</label>
                        <textarea id="purpose" name="purpose" rows="3" placeholder="Describe the purpose of this request..." required maxlength="200" data-validate="required|min:10|max:200"></textarea>
                        <small class="form-error" data-error="purpose"></small>
                    </div>

                    <!-- Contact -->
                    <div class="form-group">
                        <label for="contactDetails">Contact Details <span style="color:#9ca3af;font-weight:400;">(optional)</span></label>
                        <input type="text" id="contactDetails" name="contact_details" placeholder="Phone number or email" data-validate="contact" ${config.contactInputAttributes} />
                        <small class="form-error" data-error="contactDetails"></small>
                    </div>

                    <!-- Actions -->
                    <div class="form-actions" style="display:flex;gap:10px;margin-top:16px;">
                        <button type="button" class="btn btn-secondary" id="cancelBtn">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="${config.submitButtonId}">Submit Request</button>
                    </div>
                </form>
            </div>
        `;
    }

    function resolveTarget(target) {
        if (!target) return null;
        if (typeof target === 'string') {
            return document.getElementById(target);
        }
        return target;
    }

    function renderBorrowRequestForm(target, options = {}) {
        const container = resolveTarget(target);
        if (!container) {
            console.error('BorrowRequestForm: target container not found.', target);
            return;
        }
        const role = (options.role || container.dataset.role || 'student').toLowerCase();
        const baseConfig = DEFAULT_CONFIGS[role] || DEFAULT_CONFIGS.student;
        const config = Object.assign({}, baseConfig, options);
        container.innerHTML = buildTemplate(config);
    }

    root.Core.Templates.renderBorrowRequestForm = renderBorrowRequestForm;
})();
