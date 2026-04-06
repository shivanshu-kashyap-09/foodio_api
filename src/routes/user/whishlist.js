/**
 * @file whishlist.js (legacy filename maintained for backward compatibility)
 * @description Wishlist management routes - save favorite items
 * @version 1.0.0
 * @note Consider renaming to wishlist.js (without typo) in future versions
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const WishlistService = require('../../services/WishlistService');
const Logger = require('../../utils/Logger');

const logger = new Logger('WishlistRoute');

/**
 * GET /api/user/:userId/wishlist
 * @description Get user's wishlist with all saved items
 * @param {string} userId - User ID
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} Wishlist items with pagination
 * @access Private
 * @requires authenticateToken middleware
 */
router.get('/:userId/wishlist', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized wishlist access attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access to wishlist');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await WishlistService.getWishlist(
            parseInt(userId),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('Wishlist retrieved successfully', { userId, itemCount: result.items.length });

        return ResponseFormatter.paginated(
            res, 200, 'Wishlist retrieved successfully',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving wishlist', { userId, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/user/:userId/wishlist/add
 * @description Add item to wishlist
 * @param {string} userId - User ID
 * @body {number} itemId - Menu item ID
 * @body {string} menuType - Menu type (veg, nonveg, southindian)
 * @returns {Object} Added wishlist item
 * @access Private
 * @requires authenticateToken middleware
 */
router.post('/:userId/wishlist/add', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { itemId, menuType } = req.body;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized wishlist add attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(itemId)) {
        errors.push('Item ID must be a positive number');
    }
    if (!menuType || !['veg', 'nonveg', 'southindian'].includes(menuType.toLowerCase())) {
        errors.push('Menu type must be one of: veg, nonveg, southindian');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await WishlistService.addToWishlist(
            parseInt(userId),
            parseInt(itemId),
            menuType.toLowerCase()
        );
        logger.info('Item added to wishlist', { userId, itemId, menuType });

        return ResponseFormatter.success(res, 201, 'Item added to wishlist', result);
    } catch (error) {
        if (error.message.includes('already exists')) {
            logger.warn('Item already in wishlist', { userId, itemId });
            return ResponseFormatter.error(res, 409, 'Item already exists in wishlist');
        }
        logger.error('Error adding item to wishlist', { userId, itemId, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/user/:userId/wishlist/remove/:itemId
 * @description Remove item from wishlist
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID to remove
 * @returns {Object} Confirmation message
 * @access Private
 * @requires authenticateToken middleware
 */
router.delete('/:userId/wishlist/remove/:itemId', authenticateToken, asyncHandler(async (req, res) => {
    const { userId, itemId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized wishlist remove attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(parseInt(itemId))) {
        errors.push('Item ID must be a positive number');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await WishlistService.removeFromWishlist(parseInt(userId), parseInt(itemId));
        logger.info('Item removed from wishlist', { userId, itemId });

        return ResponseFormatter.success(res, 200, 'Item removed from wishlist', result);
    } catch (error) {
        logger.error('Error removing item from wishlist', { userId, itemId, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/user/:userId/wishlist/check/:itemId
 * @description Check if item is in wishlist
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID to check
 * @returns {Object} Boolean status
 * @access Private
 * @requires authenticateToken middleware
 */
router.get('/:userId/wishlist/check/:itemId', authenticateToken, asyncHandler(async (req, res) => {
    const { userId, itemId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized wishlist check attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate inputs
    const errors = [];
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        errors.push('User ID must be a positive number');
    }
    if (!Validator.isPositiveNumber(parseInt(itemId))) {
        errors.push('Item ID must be a positive number');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const isInWishlist = await WishlistService.isInWishlist(parseInt(userId), parseInt(itemId));
        logger.info('Wishlist check performed', { userId, itemId, isInWishlist });

        return ResponseFormatter.success(res, 200, 'Wishlist check completed', { isInWishlist });
    } catch (error) {
        logger.error('Error checking wishlist', { userId, itemId, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/user/:userId/wishlist/clear
 * @description Clear entire wishlist
 * @param {string} userId - User ID
 * @returns {Object} Confirmation message
 * @access Private
 * @requires authenticateToken middleware
 */
router.delete('/:userId/wishlist/clear', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized wishlist clear attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate userId
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        return ResponseFormatter.error(res, 400, 'Invalid user ID', ['User ID must be a positive number']);
    }

    try {
        await WishlistService.clearWishlist(parseInt(userId));
        logger.info('Wishlist cleared', { userId });

        return ResponseFormatter.success(res, 200, 'Wishlist cleared successfully', { cleared: true });
    } catch (error) {
        logger.error('Error clearing wishlist', { userId, error: error.message });
        throw error;
    }
}));

module.exports = router;
