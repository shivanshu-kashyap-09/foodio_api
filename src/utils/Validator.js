/**
 * FOODIO API - Input Validation
 * Comprehensive input validation utilities
 */

const config = require('../config/config');

class Validator {
    /**
     * Validate email format
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone format (10-15 digits)
     */
    static isValidPhone(phone) {
        const phoneRegex = /^[\d\-\s]{10,}$/;
        const digitsOnly = phone.replace(/\D/g, '');
        return digitsOnly.length >= config.validation.minPhoneLength;
    }

    /**
     * Validate password strength
     */
    static isValidPassword(password) {
        return password && password.length >= config.validation.minPasswordLength;
    }

    /**
     * Validate name format
     */
    static isValidName(name) {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        return trimmed.length >= 2 && trimmed.length <= config.validation.maxNameLength;
    }

    /**
     * Validate object is not empty
     */
    static isNotEmpty(obj) {
        return obj && Object.keys(obj).length > 0;
    }

    /**
     * Validate positive number
     */
    static isPositiveNumber(num) {
        const number = parseInt(num, 10);
        return !isNaN(number) && number > 0;
    }

    /**
     * Validate price format
     */
    static isValidPrice(price) {
        const num = parseFloat(price);
        return !isNaN(num) && num >= 0;
    }

    /**
     * Sanitize string input
     */
    static sanitizeString(str) {
        if (typeof str !== 'string') return str;
        return str
            .trim()
            .replace(/[<>]/g, '') // Remove angle brackets
            .substring(0, 255); // Limit length
    }

    /**
     * Validate pagination parameters
     */
    static validatePagination(page, limit) {
        const errors = [];
        
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        if (!this.isPositiveNumber(pageNum)) {
            errors.push('Page must be a positive number');
        }

        if (!this.isPositiveNumber(limitNum)) {
            errors.push('Limit must be a positive number');
        }

        if (limitNum > config.pagination.maxLimit) {
            errors.push(`Limit cannot exceed ${config.pagination.maxLimit}`);
        }

        return { errors, page: Math.max(1, pageNum), limit: Math.min(limitNum, config.pagination.maxLimit) };
    }

    /**
     * Validate object fields
     */
    static validateRequiredFields(obj, requiredFields) {
        const errors = [];

        requiredFields.forEach(field => {
            if (!obj[field] || (typeof obj[field] === 'string' && !obj[field].trim())) {
                errors.push(`${field} is required`);
            }
        });

        return errors;
    }

    /**
     * Validate restaurant data
     */
    static validateRestaurantData(data) {
        const errors = [];

        if (!this.isValidName(data.restaurant_name)) {
            errors.push('Restaurant name must be 2-100 characters');
        }

        if (!this.isValidPhone(data.restaurant_phone)) {
            errors.push('Invalid phone number format');
        }

        if (!data.restaurant_address || !data.restaurant_address.trim()) {
            errors.push('Restaurant address is required');
        }

        if (!data.restaurant_cuisine_type || !data.restaurant_cuisine_type.trim()) {
            errors.push('Cuisine type is required');
        }

        return errors;
    }

    /**
     * Validate menu item data
     */
    static validateMenuItemData(data) {
        const errors = [];

        if (!data.item_name || !data.item_name.trim()) {
            errors.push('Item name is required');
        }

        if (!this.isValidPrice(data.item_price)) {
            errors.push('Valid item price is required');
        }

        if (!data.item_description || !data.item_description.trim()) {
            errors.push('Item description is required');
        }

        return errors;
    }

    /**
     * Validate order data
     */
    static validateOrderData(data) {
        const errors = [];

        if (!this.isPositiveNumber(data.user_id)) {
            errors.push('Valid user ID is required');
        }

        if (!this.isPositiveNumber(data.restaurant_id)) {
            errors.push('Valid restaurant ID is required');
        }

        if (!Array.isArray(data.items) || data.items.length === 0) {
            errors.push('Order must contain at least one item');
        }

        if (!this.isValidPrice(data.total_amount)) {
            errors.push('Valid total amount is required');
        }

        return errors;
    }

    /**
     * Validate filter data
     */
    static validateFilterData(data) {
        const errors = [];

        if (data.priceMin && !this.isValidPrice(data.priceMin)) {
            errors.push('Invalid minimum price');
        }

        if (data.priceMax && !this.isValidPrice(data.priceMax)) {
            errors.push('Invalid maximum price');
        }

        if (data.priceMin && data.priceMax && 
            parseFloat(data.priceMin) > parseFloat(data.priceMax)) {
            errors.push('Minimum price cannot exceed maximum price');
        }

        if (data.rating && (data.rating < 0 || data.rating > 5)) {
            errors.push('Rating must be between 0 and 5');
        }

        return errors;
    }
}

module.exports = Validator;
