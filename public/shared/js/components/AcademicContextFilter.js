/**
 * AcademicContextFilter – Reusable academic year + term filter component.
 *
 * Usage:
 *   const filter = new AcademicContextFilter({
 *     containerId: 'academic-context-filter',   // ID of the container element
 *     onChange: (academicYearId, termId) => { ... }  // callback when filter changes
 *   });
 *   filter.init();  // fetches data and renders
 *
 *   // Get current selection:
 *   const { academic_year_id, term_id } = filter.getSelected();
 *
 *   // Build query string for API calls:
 *   const qs = filter.toQueryString(); // e.g. "academic_year_id=1&term_id=2"
 */
class AcademicContextFilter {
  constructor(options = {}) {
    this.containerId = options.containerId || 'academic-context-filter';
    this.onChange = options.onChange || null;
    this.academicYears = [];
    this.terms = [];
    this.activeAyId = null;
    this.activeTermId = null;
  }

  async init() {
    try {
      const [ayRes, termRes, activeRes] = await Promise.all([
        fetch('/api/academic-years', { headers: SmartLab.Core.Auth.getAuthHeaders() }).then(r => r.json()),
        fetch('/api/terms', { headers: SmartLab.Core.Auth.getAuthHeaders() }).then(r => r.json()),
        fetch('/api/activeAcademicContext', { headers: SmartLab.Core.Auth.getAuthHeaders() }).then(r => r.json())
      ]);

      this.academicYears = Array.isArray(ayRes) ? ayRes : [];
      this.terms = Array.isArray(termRes) ? termRes : [];

      if (activeRes && activeRes.academic_year_id) {
        this.activeAyId = activeRes.academic_year_id;
        this.activeTermId = activeRes.term_id;
      }

      this.render();
      this.bindEvents();
    } catch (err) {
      console.error('AcademicContextFilter init error:', err);
    }
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Build academic year options
    const ayOptions = this.academicYears.map(ay => {
      const selected = ay.academic_year_id === this.activeAyId ? 'selected' : '';
      return `<option value="${ay.academic_year_id}" ${selected}>${ay.academic_year}</option>`;
    }).join('');

    // Build term options
    const termOptions = this.terms.map(t => {
      const selected = t.term_id === this.activeTermId ? 'selected' : '';
      return `<option value="${t.term_id}" ${selected}>${t.term}</option>`;
    }).join('');

    container.innerHTML = `
      <div class="ac-filter">
        <select id="ac-filter-year" class="filter-select-control ac-filter-select">
          ${ayOptions}
        </select>
        <select id="ac-filter-term" class="filter-select-control ac-filter-select">
          ${termOptions}
        </select>
      </div>
    `;
  }

  bindEvents() {
    const yearSelect = document.getElementById('ac-filter-year');
    const termSelect = document.getElementById('ac-filter-term');

    if (yearSelect) {
      yearSelect.addEventListener('change', () => this._emitChange());
    }
    if (termSelect) {
      termSelect.addEventListener('change', () => this._emitChange());
    }
  }

  _emitChange() {
    if (this.onChange) {
      const { academic_year_id, term_id } = this.getSelected();
      this.onChange(academic_year_id, term_id);
    }
  }

  getSelected() {
    const yearSelect = document.getElementById('ac-filter-year');
    const termSelect = document.getElementById('ac-filter-term');

    return {
      academic_year_id: yearSelect ? Number(yearSelect.value) : this.activeAyId,
      term_id: termSelect ? Number(termSelect.value) : this.activeTermId
    };
  }

  toQueryString() {
    const { academic_year_id, term_id } = this.getSelected();
    if (academic_year_id && term_id) {
      return `academic_year_id=${academic_year_id}&term_id=${term_id}`;
    }
    return '';
  }
}

// Export globally
window.AcademicContextFilter = AcademicContextFilter;
