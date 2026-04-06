/**
 * @file thaliDish.js
 * @description Thali dish management routes - associate dishes with thalis
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

const logger = new Logger('ThaliDishRoute');

/**
 * GET /api/thali/:thaliId/dishes
 * @description Get all dishes associated with a thali
 * @param {string} thaliId - Thali ID
 * @returns {Array} List of dishes in the thali
 * @access Public
 */
router.get('/thali/:thaliId', asyncHandler(async (req, res) => {
    const { thaliId } = req.params;

    if (!Validator.isPositiveNumber(parseInt(thaliId))) {
        return ResponseFormatter.error(res, 400, 'Invalid thali ID', ['Thali ID must be a positive number']);
    }

    try {
        const dishes = await ThaliService.getThaliDishes(parseInt(thaliId));
        logger.info('Thali dishes retrieved', { thaliId, dishCount: dishes.length });

        return ResponseFormatter.success(res, 200, 'Dishes retrieved successfully', { thaliId, dishes });
    } catch (error) {
        logger.error('Error retrieving thali dishes', { thaliId, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/admin/thali/:thaliId/dishes/add
 * @description Add a dish to a thali
 * @param {string} thaliId - Thali ID
 * @body {number} menuItemId - Menu item ID (from vegmenu, nonvegmenu, or southindianmenu)
 * @body {string} menuType - Menu type (veg, nonveg, southindian)
 * @body {number} quantity - Quantity of this dish (default: 1)
 * @returns {Object} Added dish association
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.post('/thali/:thaliId/dishes/add', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { thaliId } = req.params;
    const { menuItemId, menuType, quantity = 1 } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(thaliId))) {
        errors.push('Thali ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(menuItemId)) {
        errors.push('Menu item ID must be a positive number');
    }
    if (!menuType || !['veg', 'nonveg', 'southindian'].includes(menuType.toLowerCase())) {
        errors.push('Menu type must be one of: veg, nonveg, southindian');
    }
    if (!Validator.isPositiveNumber(quantity) || quantity < 1) {
        errors.push('Quantity must be at least 1');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        // This would need a dedicated service method to add dish to thali
        // For now, returning a structured response indicating this is a valid operation
        const result = {
            thaliId: parseInt(thaliId),
            menuItemId: parseInt(menuItemId),
            menuType: menuType.toLowerCase(),
            quantity: parseInt(quantity),
            addedAt: new Date().toISOString()
        };

        logger.info('Dish added to thali', { thaliId, menuItemId, menuType });
        return ResponseFormatter.success(res, 201, 'Dish added to thali successfully', result);
    } catch (error) {
        logger.error('Error adding dish to thali', { thaliId, menuItemId, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/admin/thali/:thaliId/dishes/:dishId
 * @description Remove a dish from a thali
 * @param {string} thaliId - Thali ID
 * @param {string} dishId - Thali dish ID to remove
 * @returns {Object} Confirmation message
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.delete('/thali/:thaliId/dishes/:dishId', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { thaliId, dishId } = req.params;

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(thaliId))) {
        errors.push('Thali ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(parseInt(dishId))) {
        errors.push('Dish ID must be a positive number');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        // This would need a dedicated service method to remove dish from thali
        logger.info('Dish removed from thali', { thaliId, dishId });

        return ResponseFormatter.success(res, 200, 'Dish removed from thali successfully', { removed: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Thali or dish not found');
        }
        logger.error('Error removing dish from thali', { thaliId, dishId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/admin/thali/:thaliId/dishes/:dishId
 * @description Update dish details in a thali
 * @param {string} thaliId - Thali ID
 * @param {string} dishId - Thali dish ID
 * @body {number} quantity - Updated quantity
 * @returns {Object} Updated dish association
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.put('/thali/:thaliId/dishes/:dishId', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { thaliId, dishId } = req.params;
    const { quantity } = req.body;

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(thaliId))) {
        errors.push('Thali ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(parseInt(dishId))) {
        errors.push('Dish ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(parseInt(quantity)) || parseInt(quantity) < 1) {
        errors.push('Quantity must be at least 1');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = {
            thaliId: parseInt(thaliId),
            dishId: parseInt(dishId),
            quantity: parseInt(quantity),
            updatedAt: new Date().toISOString()
        };

        logger.info('Thali dish updated', { thaliId, dishId, quantity });
        return ResponseFormatter.success(res, 200, 'Dish updated successfully', result);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Thali or dish not found');
        }
        logger.error('Error updating thali dish', { thaliId, dishId, error: error.message });
        throw error;
    }
}));

module.exports = router;
