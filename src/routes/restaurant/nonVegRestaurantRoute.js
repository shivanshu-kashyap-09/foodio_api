/**
 * @file nonVegRestaurant.js
 * @description Non-vegetarian restaurant routes
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

const logger = new Logger('NonVegRestaurantRoute');
const RESTAURANT_TYPE = 'nonveg';

/**
 * GET /api/restaurants/nonveg
 * @description Get all non-vegetarian restaurants
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20)
 * @returns {Array} List of non-vegetarian restaurants with pagination
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const paginationErrors = Validator.validatePagination(page, limit);
    if (paginationErrors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', paginationErrors);
    }

    try {
        const result = await RestaurantService.getAllRestaurants(RESTAURANT_TYPE, parseInt(page), parseInt(limit));
        logger.info('NonVeg restaurants retrieved', { page, limit, count: result.restaurants.length });

        return ResponseFormatter.paginated(
            res, 200, 'Restaurants retrieved successfully',
            result.restaurants, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error retrieving nonveg restaurants', { error: error.message });
        throw error;
    }
}));

/**
 * GET /api/restaurants/nonveg/:id
 * @description Get a specific non-vegetarian restaurant by ID
 * @param {string} id - Restaurant ID
 * @returns {Object} Restaurant details
 * @access Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid restaurant ID', ['Restaurant ID must be a positive number']);
    }

    try {
        const restaurant = await RestaurantService.getRestaurantById(RESTAURANT_TYPE, parseInt(id));

        if (!restaurant) {
            return ResponseFormatter.error(res, 404, 'Restaurant not found');
        }

        logger.info('NonVeg restaurant retrieved', { id });
        return ResponseFormatter.success(res, 200, 'Restaurant retrieved successfully', restaurant);
    } catch (error) {
        logger.error('Error retrieving nonveg restaurant', { id, error: error.message });
        throw error;
    }
}));

/**
 * POST /api/admin/restaurants/nonveg/create
 * @description Create a new non-vegetarian restaurant (admin only)
 * @access Private (Admin only)
 */
router.post('/admin/create', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { name, cuisine, location, phone, rating, description, image } = req.body;

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
        logger.info('NonVeg restaurant created', { id: restaurant.id, name });

        return ResponseFormatter.success(res, 201, 'Restaurant created successfully', restaurant);
    } catch (error) {
        logger.error('Error creating nonveg restaurant', { name, error: error.message });
        throw error;
    }
}));

/**
 * PUT /api/admin/restaurants/nonveg/:id
 * @description Update a non-vegetarian restaurant (admin only)
 * @access Private (Admin only)
 */
router.put('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid restaurant ID', ['Restaurant ID must be a positive number']);
    }

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
        logger.info('NonVeg restaurant updated', { id });

        return ResponseFormatter.success(res, 200, 'Restaurant updated successfully', restaurant);
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Restaurant not found');
        }
        logger.error('Error updating nonveg restaurant', { id, error: error.message });
        throw error;
    }
}));

/**
 * DELETE /api/admin/restaurants/nonveg/:id
 * @description Delete a non-vegetarian restaurant (admin only)
 * @access Private (Admin only)
 */
router.delete('/admin/:id', authenticateToken, authorizeAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!Validator.isPositiveNumber(parseInt(id))) {
        return ResponseFormatter.error(res, 400, 'Invalid restaurant ID', ['Restaurant ID must be a positive number']);
    }

    try {
        await RestaurantService.deleteRestaurant(RESTAURANT_TYPE, parseInt(id));
        logger.info('NonVeg restaurant deleted', { id });

        return ResponseFormatter.success(res, 200, 'Restaurant deleted successfully', { deleted: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return ResponseFormatter.error(res, 404, 'Restaurant not found');
        }
        logger.error('Error deleting nonveg restaurant', { id, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/restaurants/nonveg/search/:searchTerm
 * @description Search non-vegetarian restaurants by name or cuisine
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
        const result = await RestaurantService.searchRestaurants(
            RESTAURANT_TYPE,
            Validator.sanitizeString(searchTerm),
            parseInt(page),
            parseInt(limit)
        );
        logger.info('NonVeg restaurants searched', { searchTerm, page, limit, count: result.restaurants.length });

        return ResponseFormatter.paginated(
            res, 200, 'Search completed',
            result.restaurants, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error searching nonveg restaurants', { searchTerm, error: error.message });
        throw error;
    }
}));

module.exports = router;
