/**
 * @file vegMenu.js
 * @description Vegetarian menu routes
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeAdmin } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const MenuService = require('../../services/MenuService');
const Logger = require('../../utils/Logger');

const logger = new Logger('VegMenuRoute');
const MENU_TYPE = 'veg';

/**
 * GET /api/menus/veg
 * @description Get all vegetarian menu items
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} List of vegetarian menu items with pagination
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', paginationErrors);
    }

    try {
        const result = await MenuService.getMenuItems(MENU_TYPE, parseInt(page), parseInt(limit));
        logger.info('Veg menu items retrieved', { page, limit, count: result.items.length });

        return ResponseFormatter.paginated(
            res, 200, 'Menu items retrieved successfully',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving veg menu items', { error: error.message });
        throw error;
    }
}));

/**
 * GET /api/menus/veg/:id
 * @description Get a specific vegetarian menu item by ID
 * @param {string} id - Menu item ID
 * @returns {Object} Menu item details
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid menu item ID', ['Menu item ID must be a positive number']);
    }

    try {
        const item = await MenuService.getMenuItemById(MENU_TYPE, parseInt(id));

        if (!item) {
            return ResponseFormatter.error(res, 404, 'Menu item not found');
        }

        logger.info('Veg menu item retrieved', { id });
        return ResponseFormatter.success(res, 200, 'Menu item retrieved successfully', item);
    } catch (error) {
        logger.error('Error retrieving veg menu item', { id, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/menus/veg/category/:category
 * @description Get vegetarian menu items by category
 * @param {string} category - Category name
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} Menu items in category with pagination
 * @access Public
 */
router.get('/category/:category', asyncHandler(async (req, res) => {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const errors = [];
    if (!category || !Validator.sanitizeString(category)) {
        errors.push('Valid category name is required');
    }

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await MenuService.getItemsByCategory(
            MENU_TYPE,
            Validator.sanitizeString(category),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('Veg menu items by category retrieved', { category, page, limit, count: result.items.length });

        return ResponseFormatter.paginated(
            res, 200, 'Menu items retrieved successfully',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving veg menu items by category', { category, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/menus/veg/search/:searchTerm
 * @description Search vegetarian menu items
 * @param {string} searchTerm - Search term
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} Search results with pagination
 * @access Public
 */
router.get('/search/:searchTerm', asyncHandler(async (req, res) => {
    const { searchTerm } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const errors = [];
    if (!searchTerm || searchTerm.length < 2) {
        errors.push('Search term must be at least 2 characters');
    }

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await MenuService.searchItems(
            MENU_TYPE,
            Validator.sanitizeString(searchTerm),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('Veg menu items searched', { searchTerm, page, limit, count: result.items.length });

        return ResponseFormatter.paginated(
            res, 200, 'Search completed',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error searching veg menu items', { searchTerm, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/menus/veg/filter/price
 * @description Filter vegetarian menu items by price range
 * @query {number} minPrice - Minimum price
 * @query {number} maxPrice - Maximum price
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} Filtered items with pagination
 * @access Public
 */
router.get('/filter/price', asyncHandler(async (req, res) => {
    const { minPrice, maxPrice, page = 1, limit = 20 } = req.query;

    const errors = [];
    if (!Validator.isPositiveNumber(Number(minPrice))) {
        errors.push('Minimum price must be a positive number');
    }
    if (!Validator.isPositiveNumber(Number(maxPrice))) {
        errors.push('Maximum price must be a positive number');
    }
    if (Number(minPrice) > Number(maxPrice)) {
        errors.push('Minimum price must be less than or equal to maximum price');
    }

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const result = await MenuService.filterByPrice(
            MENU_TYPE,
            Number(minPrice),
            Number(maxPrice),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('Veg menu items filtered by price', { minPrice, maxPrice, page, limit, count: result.items.length });

        return ResponseFormatter.paginated(
            res, 200, 'Items retrieved successfully',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error filtering veg menu items by price', { minPrice, maxPrice, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/admin/menus/veg/create
 * @description Create a new vegetarian menu item (admin only)
 * @body {string} name - Item name
 * @body {string} description - Item description
 * @body {number} price - Item price
 * @body {string} category - Item category
 * @body {string} image - Item image URL
 * @returns {Object} Created menu item
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.post('/admin/create', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { name, description, price, category, image } = req.body;

    const errors = Validator.validateMenuItemData({ name, description, price, category });
    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const itemData = {
            name: Validator.sanitizeString(name),
            description: Validator.sanitizeString(description),
            price: parseFloat(price),
            category: Validator.sanitizeString(category),
            image: Validator.sanitizeString(image) || null
        };

        const item = await MenuService.createMenuItem(MENU_TYPE, itemData);
        logger.info('Veg menu item created', { id: item.id, name });

        return ResponseFormatter.success(res, 201, 'Menu item created successfully', item);
    } catch (error) {
        logger.error('Error creating veg menu item', { name, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/admin/menus/veg/:id
 * @description Update a vegetarian menu item (admin only)
 * @param {string} id - Menu item ID
 * @body {Object} updateData - Fields to update
 * @returns {Object} Updated menu item
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.put('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid menu item ID', ['Menu item ID must be a positive number']);
    }

    const sanitizedData = {};
    if (updateData.name) sanitizedData.name = Validator.sanitizeString(updateData.name);
    if (updateData.description) sanitizedData.description = Validator.sanitizeString(updateData.description);
    if (updateData.price) sanitizedData.price = parseFloat(updateData.price);
    if (updateData.category) sanitizedData.category = Validator.sanitizeString(updateData.category);
    if (updateData.image) sanitizedData.image = Validator.sanitizeString(updateData.image);

    if (Object.keys(sanitizedData).length === 0) {
        return ResponseFormatter.error(res, 400, 'No fields to update');
    }

    try {
        const item = await MenuService.updateMenuItem(MENU_TYPE, parseInt(id), sanitizedData);
        logger.info('Veg menu item updated', { id });

        return ResponseFormatter.success(res, 200, 'Menu item updated successfully', item);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Menu item not found');
        }
        logger.error('Error updating veg menu item', { id, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/admin/menus/veg/:id
 * @description Delete a vegetarian menu item (admin only)
 * @param {string} id - Menu item ID
 * @returns {Object} Confirmation message
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.delete('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid menu item ID', ['Menu item ID must be a positive number']);
    }

    try {
        await MenuService.deleteMenuItem(MENU_TYPE, parseInt(id));
        logger.info('Veg menu item deleted', { id });

        return ResponseFormatter.success(res, 200, 'Menu item deleted successfully', { deleted: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Menu item not found');
        }
        logger.error('Error deleting veg menu item', { id, error: error.message });
        throw error;
    }
}));

module.exports = router;
