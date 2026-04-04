/**
 * @file cartRoute.js
 * @description Cart management routes - add, remove, update items
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const CartService = require('../../services/CartService');
const Logger = require('../../utils/Logger');

const logger = new Logger('CartRoute');

/**
 * GET /api/user/:userId/cart
 * @description Get user's shopping cart with all items and total
 * @param {string} userId - User ID
 * @returns {Object} Cart items with prices and total
 * @access Private
 * @requires authenticateToken middleware
 */
router.get('/:userId/cart', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized cart access attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access to cart');
    }

    // Validate userId
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        return ResponseFormatter.error(res, 400, 'Invalid user ID', ['User ID must be a positive number']);
    }

    try {
        const cart = await CartService.getCart(parseInt(userId));
        logger.info('Cart retrieved successfully', { userId, itemCount: cart.items.length });

        return ResponseFormatter.success(res, 200, 'Cart retrieved successfully', cart);
    } catch (error) {
        logger.error('Error retrieving cart', { userId, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/user/:userId/cart/add
 * @description Add item to cart or increment quantity if exists
 * @param {string} userId - User ID
 * @body {Object} item - Item details
 * @body {number} item.itemId - Menu item ID
 * @body {number} item.quantity - Quantity to add (default: 1)
 * @body {string} item.menuType - Menu type (veg, nonveg, southindian)
 * @returns {Object} Updated cart item
 * @access Private
 * @requires authenticateToken middleware
 */
router.post('/:userId/cart/add', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { itemId, quantity = 1, menuType } = req.body;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized cart add attempt', { userId, requestUserId: req.user.id });
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
    if (!Validator.isPositiveNumber(quantity) || quantity < 1) {
        errors.push('Quantity must be at least 1');
    }
    if (!menuType || !['veg', 'nonveg', 'southindian'].includes(menuType.toLowerCase())) {
        errors.push('Menu type must be one of: veg, nonveg, southindian');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await CartService.addToCart(
            parseInt(userId),
            parseInt(itemId),
            parseInt(quantity),
            menuType.toLowerCase()
        );
        logger.info('Item added to cart', { userId, itemId, quantity });

        return ResponseFormatter.success(res, 201, 'Item added to cart', result);
    } catch (error) {
        logger.error('Error adding item to cart', { userId, itemId, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/user/:userId/cart/update/:itemId
 * @description Update item quantity in cart
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @body {number} quantity - New quantity (0 to remove)
 * @returns {Object} Updated cart
 * @access Private
 * @requires authenticateToken middleware
 */
router.put('/:userId/cart/update/:itemId', authenticateToken, asyncHandler(async (req, res) => {
    const { userId, itemId } = req.params;
    const { quantity } = req.body;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized cart update attempt', { userId, requestUserId: req.user.id });
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
    if (quantity === undefined || quantity === null || !Validator.isPositiveNumber(quantity)) {
        errors.push('Quantity must be a positive number');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await CartService.updateCartItem(parseInt(userId), parseInt(itemId), parseInt(quantity));
        logger.info('Cart item updated', { userId, itemId, quantity });

        return ResponseFormatter.success(res, 200, 'Cart item updated successfully', result);
    } catch (error) {
        logger.error('Error updating cart item', { userId, itemId, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/user/:userId/cart/remove/:itemId
 * @description Remove item from cart
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID to remove
 * @returns {Object} Updated cart
 * @access Private
 * @requires authenticateToken middleware
 */
router.delete('/:userId/cart/remove/:itemId', authenticateToken, asyncHandler(async (req, res) => {
    const { userId, itemId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized cart remove attempt', { userId, requestUserId: req.user.id });
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
        const result = await CartService.removeFromCart(parseInt(userId), parseInt(itemId));
        logger.info('Item removed from cart', { userId, itemId });

        return ResponseFormatter.success(res, 200, 'Item removed from cart', result);
    } catch (error) {
        logger.error('Error removing item from cart', { userId, itemId, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/user/:userId/cart/clear
 * @description Clear entire cart
 * @param {string} userId - User ID
 * @returns {Object} Confirmation message
 * @access Private
 * @requires authenticateToken middleware
 */
router.delete('/:userId/cart/clear', authenticateToken, asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Authorization check
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
        logger.warn('Unauthorized cart clear attempt', { userId, requestUserId: req.user.id });
        return ResponseFormatter.error(res, 403, 'Unauthorized access');
    }

    // Validate userId
    if (!Validator.isPositiveNumber(parseInt(userId))) {
        return ResponseFormatter.error(res, 400, 'Invalid user ID', ['User ID must be a positive number']);
    }

    try {
        await CartService.clearCart(parseInt(userId));
        logger.info('Cart cleared', { userId });

        return ResponseFormatter.success(res, 200, 'Cart cleared successfully', { cleared: true });
    } catch (error) {
        logger.error('Error clearing cart', { userId, error: error.message });
        throw error;
    }
}));

module.exports = router;
