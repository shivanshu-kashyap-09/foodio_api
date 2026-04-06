/**
 * @file thali.js
 * @description Thali (special meal set) routes
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeAdmin } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const ThaliService = require('../../services/ThaliService');
const Logger = require('../../utils/Logger');

const logger = new Logger('ThaliRoute');

/**
 * GET /api/thali
 * @description Get all thalis
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} List of thalis with pagination
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', paginationErrors);
    }

    try {
        const result = await ThaliService.getAllThalis(parseInt(page), parseInt(limit));
        logger.info('Thalis retrieved', { page, limit, count: result.thalis.length });

        return ResponseFormatter.paginated(
            res, 200, 'Thalis retrieved successfully',
            result.thalis, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving thalis', { error: error.message });
        throw error;
    }
}));

/**
 * GET /api/thali/:id
 * @description Get a specific thali by ID
 * @param {string} id - Thali ID
 * @returns {Object} Thali details
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid thali ID', ['Thali ID must be a positive number']);
    }

    try {
        const thali = await ThaliService.getThaliById(parseInt(id));

        if (!thali) {
            return ResponseFormatter.error(res, 404, 'Thali not found');
        }

        logger.info('Thali retrieved', { id });
        return ResponseFormatter.success(res, 200, 'Thali retrieved successfully', thali);
    } catch (error) {
        logger.error('Error retrieving thali', { id, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/thali/:id/dishes
 * @description Get all dishes in a thali
 * @param {string} id - Thali ID
 * @returns {Array} List of dishes in the thali
 * @access Public
 */
router.get('/:id/dishes', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid thali ID', ['Thali ID must be a positive number']);
    }

    try {
        const dishes = await ThaliService.getThaliDishes(parseInt(id));
        logger.info('Thali dishes retrieved', { thaliId: id, dishCount: dishes.length });

        return ResponseFormatter.success(res, 200, 'Dishes retrieved successfully', { thaliId: id, dishes });
    } catch (error) {
        logger.error('Error retrieving thali dishes', { id, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/admin/thali/create
 * @description Create a new thali (admin only)
 * @body {string} name - Thali name
 * @body {number} price - Thali price
 * @body {string} description - Thali description
 * @body {number} rating - Thali rating
 * @body {string} image - Thali image URL
 * @returns {Object} Created thali
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.post('/admin/create', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { name, price, description, rating, image } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isValidName(name)) {
        errors.push('Name must be between 2 and 100 characters');
    }
    if (!Validator.isPositiveNumber(price) || price < 1) {
        errors.push('Price must be a positive number');
    }
    if (!description || !Validator.sanitizeString(description) || description.length < 5) {
        errors.push('Description must be at least 5 characters');
    }
    if (!Validator.isPositiveNumber(rating) || rating < 0 || rating > 5) {
        errors.push('Rating must be between 0 and 5');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const thaliData = {
            name: Validator.sanitizeString(name),
            price: parseFloat(price),
            description: Validator.sanitizeString(description),
            rating: parseFloat(rating),
            image: Validator.sanitizeString(image) || null
        };

        const thali = await ThaliService.createThali(thaliData);
        logger.info('Thali created', { id: thali.id, name });

        return ResponseFormatter.success(res, 201, 'Thali created successfully', thali);
    } catch (error) {
        logger.error('Error creating thali', { name, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/admin/thali/:id
 * @description Update a thali (admin only)
 * @param {string} id - Thali ID
 * @body {Object} updateData - Fields to update
 * @returns {Object} Updated thali
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.put('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid thali ID', ['Thali ID must be a positive number']);
    }

    const sanitizedData = {};
    if (updateData.name) sanitizedData.name = Validator.sanitizeString(updateData.name);
    if (updateData.price) sanitizedData.price = parseFloat(updateData.price);
    if (updateData.description) sanitizedData.description = Validator.sanitizeString(updateData.description);
    if (updateData.rating) sanitizedData.rating = parseFloat(updateData.rating);
    if (updateData.image) sanitizedData.image = Validator.sanitizeString(updateData.image);

    if (Object.keys(sanitizedData).length === 0) {
        return ResponseFormatter.error(res, 400, 'No fields to update');
    }

    try {
        const thali = await ThaliService.updateThali(parseInt(id), sanitizedData);
        logger.info('Thali updated', { id });

        return ResponseFormatter.success(res, 200, 'Thali updated successfully', thali);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Thali not found');
        }
        logger.error('Error updating thali', { id, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/admin/thali/:id
 * @description Delete a thali (admin only)
 * @param {string} id - Thali ID
 * @returns {Object} Confirmation message
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.delete('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid thali ID', ['Thali ID must be a positive number']);
    }

    try {
        await ThaliService.deleteThali(parseInt(id));
        logger.info('Thali deleted', { id });

        return ResponseFormatter.success(res, 200, 'Thali deleted successfully', { deleted: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Thali not found');
        }
        logger.error('Error deleting thali', { id, error: error.message });
        throw error;
    }
}));

module.exports = router;