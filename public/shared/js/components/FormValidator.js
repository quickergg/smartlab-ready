/* =========================================
   SmartLab - Form Validator Component
   Reusable form validation system
========================================= */

class FormValidator {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            validateOnBlur: true,
            validateOnInput: false,
            showErrors: true,
            errorClass: 'error',
            ...options
        };
        
        this.rules = new Map();
        this.errors = new Map();
        
        this.init();
    }
    
    init() {
        this.setupValidation();
    }
    
    setupValidation() {
        // Find all form inputs with validation rules
        const inputs = this.element.querySelectorAll('[data-validate]');
        
        inputs.forEach(input => {
            const rules = this.parseRules(input.dataset.validate);
            this.rules.set(input, rules);
            
            // Add event listeners
            if (this.options.validateOnBlur) {
                input.addEventListener('blur', () => this.validateField(input));
            }
            
            if (this.options.validateOnInput) {
                input.addEventListener('input', () => this.validateField(input));
            }
        });
        
        // Validate form on submit
        this.element.addEventListener('submit', (e) => {
            if (!this.validateForm()) {
                e.preventDefault();
                return false;
            }
        });
    }
    
    parseRules(ruleString) {
        const rules = [];
        const ruleParts = ruleString.split('|');
        
        ruleParts.forEach(rule => {
            const [ruleName, ...params] = rule.split(':');
            rules.push({
                name: ruleName,
                params: params.join(':')
            });
        });
        
        return rules;
    }
    
    validateField(input) {
        const rules = this.rules.get(input);
        if (!rules) return true;
        
        const value = input.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        for (const rule of rules) {
            const result = this.applyRule(rule.name, value, rule.params, input);
            if (!result.valid) {
                isValid = false;
                errorMessage = result.message;
                break; // Stop at first error
            }
        }
        
        this.updateFieldUI(input, isValid, errorMessage);
        return isValid;
    }
    
    applyRule(ruleName, value, params, input) {
        switch (ruleName) {
            case 'required':
                return {
                    valid: value.length > 0,
                    message: `${this.getFieldName(input)} is required`
                };
                
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return {
                    valid: !value || emailRegex.test(value),
                    message: 'Please enter a valid email address'
                };
                
            case 'min':
                const minLength = parseInt(params);
                return {
                    valid: !value || value.length >= minLength,
                    message: `${this.getFieldName(input)} must be at least ${minLength} characters`
                };
                
            case 'max':
                const maxLength = parseInt(params);
                return {
                    valid: !value || value.length <= maxLength,
                    message: `${this.getFieldName(input)} must not exceed ${maxLength} characters`
                };
                
            case 'date':
                const date = new Date(value);
                return {
                    valid: !value || !isNaN(date.getTime()),
                    message: 'Please enter a valid date'
                };
                
            case 'date-min':
                const minDate = new Date(params);
                const inputDate = new Date(value);
                return {
                    valid: !value || inputDate >= minDate,
                    message: `Date must be on or after ${minDate.toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}`
                };
                
            case 'date-advance':
                const days = parseInt(params) || 3;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const advanceDate = new Date(today);
                advanceDate.setDate(today.getDate() + days);
                const checkDate = new Date(value);
                checkDate.setHours(0, 0, 0, 0);
                return {
                    valid: !value || checkDate >= advanceDate,
                    message: `Date must be at least ${days} days in advance`
                };
                
            case 'number':
                const num = parseFloat(value);
                return {
                    valid: !value || !isNaN(num),
                    message: 'Please enter a valid number'
                };
                
            case 'min-value':
                const minValue = parseFloat(params);
                const numValue = parseFloat(value);
                return {
                    valid: !value || numValue >= minValue,
                    message: `${this.getFieldName(input)} must be at least ${minValue}`
                };
                
            case 'max-value':
                const maxValue = parseFloat(params);
                const numMaxValue = parseFloat(value);
                return {
                    valid: !value || numMaxValue <= maxValue,
                    message: `${this.getFieldName(input)} must not exceed ${maxValue}`
                };
                
            case 'pattern':
                const pattern = new RegExp(params);
                return {
                    valid: !value || pattern.test(value),
                    message: `${this.getFieldName(input)} format is invalid`
                };
                
            case 'contact':
                const phoneRegex = /^(\+?63|0)9\d{9}$/;
                const emailCheck = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return {
                    valid: !value || phoneRegex.test(value) || emailCheck.test(value),
                    message: `${this.getFieldName(input)} must be a valid PH mobile number or email`
                };
            case 'time-slot':
                const slots = FormValidator.getHalfHourSlots();
                return {
                    valid: !value || slots.includes(value),
                    message: `${this.getFieldName(input)} must use 30-minute increments between 07:30 AM and 09:00 PM`
                };
            default:
                return { valid: true, message: '' };
        }
    }
    
    getFieldName(input) {
        const label = this.element.querySelector(`label[for="${input.id}"]`);
        if (label) {
            return label.textContent.replace('*', '').trim();
        }
        
        const placeholder = input.placeholder;
        if (placeholder) {
            return placeholder;
        }
        
        return input.name || 'Field';
    }
    
    updateFieldUI(input, isValid, errorMessage) {
        const errorElement = this.element.querySelector(`[data-error="${input.id}"]`) ||
                            input.parentNode.querySelector('.error-message') ||
                            input.parentNode.querySelector('.form-error');
        
        if (isValid) {
            input.classList.remove(this.options.errorClass);
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
            }
            this.errors.delete(input);
        } else {
            input.classList.add(this.options.errorClass);
            if (errorElement && this.options.showErrors) {
                errorElement.textContent = errorMessage;
                errorElement.style.display = 'block';
            }
            this.errors.set(input, errorMessage);
        }
    }
    
    validateForm() {
        const inputs = Array.from(this.rules.keys());
        let isValid = true;
        
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    getErrors() {
        return new Map(this.errors);
    }
    
    hasErrors() {
        return this.errors.size > 0;
    }
    
    clearErrors() {
        this.errors.clear();
        const inputs = Array.from(this.rules.keys());
        inputs.forEach(input => {
            this.updateFieldUI(input, true, '');
        });
    }
    
    // Static method for quick validation
    static validate(element, options = {}) {
        return new FormValidator(element, options);
    }

    static getHalfHourSlots() {
        if (!FormValidator._halfHourSlots) {
            const slots = [];
            let hour = 7;
            let minute = 30;
            while (hour < 21 || (hour === 21 && minute === 0)) {
                const hh = String(hour).padStart(2, '0');
                const mm = String(minute).padStart(2, '0');
                slots.push(`${hh}:${mm}`);
                minute += 30;
                if (minute >= 60) {
                    minute -= 60;
                    hour += 1;
                }
            }
            FormValidator._halfHourSlots = slots;
        }
        return FormValidator._halfHourSlots;
    }
}

// Register component with SmartLab Core
SmartLab.Core.Components.register('FormValidator', FormValidator);

// Auto-initialize form validators
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-component="FormValidator"]').forEach(element => {
        const validator = SmartLab.Core.Components.create('FormValidator', element);
        if (validator) {
            validator.init();
        }
    });
    
    // Also initialize forms with data-validate attributes
    document.querySelectorAll('form[data-validate]').forEach(form => {
        const validator = SmartLab.Core.Components.create('FormValidator', form);
        if (validator) {
            validator.init();
        }
    });
});
