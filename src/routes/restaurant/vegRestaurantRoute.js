/**
 * @file vegRestaurant.js
 * @description Vegetarian restaurant routes
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, authorizeAdmin } = require('../../middleware/Auth');
const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const RestaurantService = require('../../services/RestaurantService');
const Logger = require('../../utils/Logger');

const logger = new Logger('VegRestaurantRoute');
const RESTAURANT_TYPE = 'veg';

/**
 * GET /api/restaurants/veg
 * @description Get all vegetarian restaurants
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} List of vegetarian restaurants with pagination
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    // Validate inputs
    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', paginationErrors);
    }

    try {
        const result = await RestaurantService.getAllRestaurants(RESTAURANT_TYPE, parseInt(page), parseInt(limit));
        logger.info('Veg restaurants retrieved', { page, limit, count: result.restaurants.length });

        return ResponseFormatter.paginated(
            res, 200, 'Restaurants retrieved successfully',
            result.restaurants, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving veg restaurants', { error: error.message });
        throw error;
    }
}));

/**
 * GET /api/restaurants/veg/:id
 * @description Get a specific vegetarian restaurant by ID
 * @param {string} id - Restaurant ID
 * @returns {Object} Restaurant details
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ID
    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid restaurant ID', ['Restaurant ID must be a positive number']);
    }

    try {
        const restaurant = await RestaurantService.getRestaurantById(RESTAURANT_TYPE, parseInt(id));

        if (!restaurant) {
            return ResponseFormatter.error(res, 404, 'Restaurant not found');
        }

        logger.info('Veg restaurant retrieved', { id });
        return ResponseFormatter.success(res, 200, 'Restaurant retrieved successfully', restaurant);
    } catch (error) {
        logger.error('Error retrieving veg restaurant', { id, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/admin/restaurants/veg/create
 * @description Create a new vegetarian restaurant (admin only)
 * @body {string} name - Restaurant name
 * @body {string} cuisine - Cuisine type
 * @body {string} location - Restaurant location
 * @body {string} phone - Contact phone
 * @body {number} rating - Initial rating
 * @body {string} description - Restaurant description
 * @body {string} image - Restaurant image URL
 * @returns {Object} Created restaurant
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.post('/admin/create', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { name, cuisine, location, phone, rating, description, image } = req.body;

    // Validate inputs
    const errors = Validator.validateRestaurantData({ name, cuisine, location, phone, rating, description });
    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        const restaurantData = {
            name: Validator.sanitizeString(name),
            cuisine: Validator.sanitizeString(cuisine),
            location: Validator.sanitizeString(location),
            phone,
            rating: parseFloat(rating),
            description: Validator.sanitizeString(description),
            image: Validator.sanitizeString(image) || null
        };

        const restaurant = await RestaurantService.createRestaurant(RESTAURANT_TYPE, restaurantData);
        logger.info('Veg restaurant created', { id: restaurant.id, name });

        return ResponseFormatter.success(res, 201, 'Restaurant created successfully', restaurant);
    } catch (error) {
        logger.error('Error creating veg restaurant', { name, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/admin/restaurants/veg/:id
 * @description Update a vegetarian restaurant (admin only)
 * @param {string} id - Restaurant ID
 * @body {Object} updateData - Fields to update
 * @returns {Object} Updated restaurant
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.put('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ID
    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid restaurant ID', ['Restaurant ID must be a positive number']);
    }

    // Sanitize update data
    const sanitizedData = {};
    if (updateData.name) sanitizedData.name = Validator.sanitizeString(updateData.name);
    if (updateData.cuisine) sanitizedData.cuisine = Validator.sanitizeString(updateData.cuisine);
    if (updateData.location) sanitizedData.location = Validator.sanitizeString(updateData.location);
    if (updateData.phone) sanitizedData.phone = updateData.phone;
    if (updateData.rating) sanitizedData.rating = parseFloat(updateData.rating);
    if (updateData.description) sanitizedData.description = Validator.sanitizeString(updateData.description);
    if (updateData.image) sanitizedData.image = Validator.sanitizeString(updateData.image);

    if (Object.keys(sanitizedData).length === 0) {
        return ResponseFormatter.error(res, 400, 'No fields to update');
    }

    try {
        const restaurant = await RestaurantService.updateRestaurant(RESTAURANT_TYPE, parseInt(id), sanitizedData);
        logger.info('Veg restaurant updated', { id });

        return ResponseFormatter.success(res, 200, 'Restaurant updated successfully', restaurant);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Restaurant not found');
        }
        logger.error('Error updating veg restaurant', { id, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/admin/restaurants/veg/:id
 * @description Delete a vegetarian restaurant (admin only)
 * @param {string} id - Restaurant ID
 * @returns {Object} Confirmation message
 * @access Private (Admin only)
 * @requires authenticateToken, authorizeAdmin middleware
 */
router.delete('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ID
    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid restaurant ID', ['Restaurant ID must be a positive number']);
    }

    try {
        await RestaurantService.deleteRestaurant(RESTAURANT_TYPE, parseInt(id));
        logger.info('Veg restaurant deleted', { id });

        return ResponseFormatter.success(res, 200, 'Restaurant deleted successfully', { deleted: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Restaurant not found');
        }
        logger.error('Error deleting veg restaurant', { id, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/restaurants/veg/search/:searchTerm
 * @description Search vegetarian restaurants by name or cuisine
 * @param {string} searchTerm - Search term
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} Search results with pagination
 * @access Public
 */
router.get('/search/:searchTerm', asyncHandler(async (req, res) => {
    const { searchTerm } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Validate inputs
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
        const result = await RestaurantService.searchRestaurants(
            RESTAURANT_TYPE,
            Validator.sanitizeString(searchTerm),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('Veg restaurants searched', { searchTerm, page, limit, count: result.restaurants.length });

        return ResponseFormatter.paginated(
            res, 200, 'Search completed',
            result.restaurants, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error searching veg restaurants', { searchTerm, error: error.message });
        throw error;
    }
}));

module.exports = router;
