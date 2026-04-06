/**
 * @file searchRoute.js
 * @description Global search and filter routes for discovering dishes across all menu types
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

const { asyncHandler } = require('../../middleware/ErrorHandler');
const ResponseFormatter = require('../../utils/ResponseFormatter');
const Validator = require('../../utils/Validator');
const MenuService = require('../../services/MenuService');
const Cache = require('../../utils/Cache');
const Logger = require('../../utils/Logger');

const logger = new Logger('SearchRoute');

/**
 * GET /api/search
 * @description Global search across all menu types (veg, nonveg, southindian)
 * @query {string} q - Search term (required, min 2 characters)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @returns {Array} Search results with pagination
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const { q: searchTerm, page = 1, limit = 20 } = req.query;

    // Validate search term
    const errors = [];
    if (!searchTerm || searchTerm.length < 2) {
        errors.push('Search term must be at least 2 characters');
    }
    if (searchTerm && searchTerm.length > 100) {
        errors.push('Search term must not exceed 100 characters');
    }

    // Validate pagination
    const paginationErrors = Validator.validatePagination(page, limit, 100);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        // Check cache first
        const cacheKey = `search:global:${searchTerm}:${page}`;
        const cached = await Cache.get(cacheKey);
        if (cached) {
            logger.debug('Search result from cache', { searchTerm, page });
            const result = JSON.parse(cached);
            return ResponseFormatter.paginated(
                res, 200, 'Search completed (cached)',
                result.items, result.total, page, limit
            );
        }

        const sanitizedTerm = Validator.sanitizeString(searchTerm);
        const result = await MenuService.searchAcrossAll(
            sanitizedTerm,
            parseInt(page),
            parseInt(limit)
        );

        // Cache the result for 30 minutes
        await Cache.set(cacheKey, JSON.stringify(result), 1800);

        logger.info('Global search completed', { searchTerm, results: result.items.length, total: result.total });

        return ResponseFormatter.paginated(
            res, 200, 'Search completed',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error performing global search', { searchTerm, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/search/filter
 * @description Advanced filter across all menu types with optional search
 * @query {string} q - Search term (optional)
 * @query {string} cuisineTypes - Comma-separated cuisine types (optional, values: veg,nonveg,southindian)
 * @query {number} minPrice - Minimum price (optional)
 * @query {number} maxPrice - Maximum price (optional)
 * @query {number} minRating - Minimum rating 0-5 (optional)
 * @query {number} restaurantId - Filter by restaurant ID (optional)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 100)
 * @returns {Array} Filtered results with pagination
 * @access Public
 */
router.get('/filter', asyncHandler(async (req, res) => {
    const {
        q: searchTerm,
        cuisineTypes: cuisineTypesStr = 'veg,nonveg,southindian',
        minPrice,
        maxPrice,
        minRating,
        restaurantId,
        page = 1,
        limit = 20,
    } = req.query;

    const errors = [];

    // Validate cuisine types
    const validCuisines = ['veg', 'nonveg', 'southindian'];
    let cuisineTypes = cuisineTypesStr;
    if (typeof cuisineTypesStr === 'string') {
        cuisineTypes = cuisineTypesStr.split(',').map(c => c.trim().toLowerCase());
        const invalidCuisines = cuisineTypes.filter(c => !validCuisines.includes(c));
        if (invalidCuisines.length > 0) {
            errors.push(`Invalid cuisine types: ${invalidCuisines.join(', ')}. Valid options: veg, nonveg, southindian`);
        }
    }

    // Validate price range
    if (minPrice !== undefined && !Validator.isPositiveNumber(Number(minPrice))) {
        errors.push('Minimum price must be a positive number');
    }
    if (maxPrice !== undefined && !Validator.isPositiveNumber(Number(maxPrice))) {
        errors.push('Maximum price must be a positive number');
    }
    if (minPrice !== undefined && maxPrice !== undefined && Number(minPrice) > Number(maxPrice)) {
        errors.push('Minimum price must be less than or equal to maximum price');
    }

    // Validate rating
    if (minRating !== undefined) {
        const rating = Number(minRating);
        if (rating < 0 || rating > 5 || isNaN(rating)) {
            errors.push('Minimum rating must be between 0 and 5');
        }
    }

    // Validate restaurant ID
    if (restaurantId !== undefined && !Validator.isPositiveNumber(Number(restaurantId))) {
        errors.push('Restaurant ID must be a positive number');
    }

    // Validate pagination
    const paginationErrors = Validator.validatePagination(page, limit, 100);
    if (paginationErrors.length > 0) {
        errors.push(...paginationErrors);
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        // Build filter object
        const filters = {
            cuisineTypes,
            searchTerm: searchTerm ? Validator.sanitizeString(searchTerm) : null,
            minPrice: minPrice !== undefined ? Number(minPrice) : null,
            maxPrice: maxPrice !== undefined ? Number(maxPrice) : null,
            minRating: minRating !== undefined ? Number(minRating) : null,
            restaurantId: restaurantId !== undefined ? Number(restaurantId) : null,
        };

        // Check cache
        const filterStr = JSON.stringify(filters).replace(/"/g, '');
        const cacheKey = `search:filter:${filterStr}:${page}`;
        const cached = await Cache.get(cacheKey);
        if (cached) {
            logger.debug('Filter result from cache', { filters, page });
            const result = JSON.parse(cached);
            return ResponseFormatter.paginated(
                res, 200, 'Filter completed (cached)',
                result.items, result.total, page, limit
            );
        }

        const result = await MenuService.filterAdvanced(filters, parseInt(page), parseInt(limit));

        // Cache for 15 minutes (less than search cache)
        await Cache.set(cacheKey, JSON.stringify(result), 900);

        logger.info('Advanced filter completed', {
            filters,
            results: result.items.length,
            total: result.total,
        });

        return ResponseFormatter.paginated(
            res, 200, 'Filter completed',
            result.items, result.total, page, limit
        );
    } catch (error) {
        logger.error('Error performing advanced filter', { error: error.message });
        throw error;
    }
}));

/**
 * GET /api/search/suggestions
 * @description Get autocomplete suggestions for search
 * @query {string} q - Search prefix (required, min 2 characters)
 * @query {number} limit - Number of suggestions (default: 10, max: 50)
 * @returns {Array} Array of suggested dish names
 * @access Public
 */
router.get('/suggestions', asyncHandler(async (req, res) => {
    const { q: prefix, limit = 10 } = req.query;

    const errors = [];
    if (!prefix || prefix.length < 2) {
        errors.push('Search prefix must be at least 2 characters');
    }
    if (prefix && prefix.length > 100) {
        errors.push('Search prefix must not exceed 100 characters');
    }
    if (!Validator.isPositiveNumber(Number(limit)) || Number(limit) > 50) {
        errors.push('Limit must be a positive number not exceeding 50');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        // Check cache
        const cacheKey = `search:suggestions:${prefix.toLowerCase()}:${limit}`;
        const cached = await Cache.get(cacheKey);
        if (cached) {
            logger.debug('Suggestions from cache', { prefix });
            const suggestions = JSON.parse(cached);
            return ResponseFormatter.success(
                res, 200, 'Suggestions retrieved',
                { suggestions }
            );
        }

        const sanitizedPrefix = Validator.sanitizeString(prefix);
        const suggestions = await MenuService.getSearchSuggestions(sanitizedPrefix, parseInt(limit));

        // Cache for 60 minutes (aggressive caching for stable data)
        await Cache.set(cacheKey, JSON.stringify(suggestions), 3600);

        logger.info('Search suggestions retrieved', { prefix, count: suggestions.length });

        return ResponseFormatter.success(
            res, 200, 'Suggestions retrieved',
            { suggestions }
        );
    } catch (error) {
        logger.error('Error retrieving suggestions', { prefix, error: error.message });
        throw error;
    }
}));

/**
 * GET /api/search/trending
 * @description Get trending (highest rated) dishes across all menu types
 * @query {string} cuisineTypes - Comma-separated cuisine types (optional, default: all)
 * @query {number} limit - Number of results (default: 10, max: 50)
 * @returns {Array} Array of trending dishes
 * @access Public
 */
router.get('/trending', asyncHandler(async (req, res) => {
    const { cuisineTypes: cuisineTypesStr = 'veg,nonveg,southindian', limit = 10 } = req.query;

    const errors = [];

    // Validate cuisine types
    const validCuisines = ['veg', 'nonveg', 'southindian'];
    let cuisineTypes = cuisineTypesStr;
    if (typeof cuisineTypesStr === 'string') {
        cuisineTypes = cuisineTypesStr.split(',').map(c => c.trim().toLowerCase());
        const invalidCuisines = cuisineTypes.filter(c => !validCuisines.includes(c));
        if (invalidCuisines.length > 0) {
            errors.push(`Invalid cuisine types: ${invalidCuisines.join(', ')}. Valid options: veg, nonveg, southindian`);
        }
    }

    // Validate limit
    if (!Validator.isPositiveNumber(Number(limit)) || Number(limit) > 50) {
        errors.push('Limit must be a positive number not exceeding 50');
    }

    if (errors.length > 0) {
        return ResponseFormatter.error(res, 400, 'Validation failed', errors);
    }

    try {
        // Check cache
        const cacheKey = `search:trending:${cuisineTypes.join(',')}:${limit}`;
        const cached = await Cache.get(cacheKey);
        if (cached) {
            logger.debug('Trending results from cache', { cuisineTypes });
            const trendingDishes = JSON.parse(cached);
            return ResponseFormatter.success(
                res, 200, 'Trending dishes retrieved',
                { dishes: trendingDishes, count: trendingDishes.length }
            );
        }

        const trendingDishes = await MenuService.getTrendingDishes(cuisineTypes, parseInt(limit), 4.0);

        // Cache for 2 hours (very stable data)
        await Cache.set(cacheKey, JSON.stringify(trendingDishes), 7200);

        logger.info('Trending dishes retrieved', { cuisineTypes, count: trendingDishes.length });

        return ResponseFormatter.success(
            res, 200, 'Trending dishes retrieved',
            { dishes: trendingDishes, count: trendingDishes.length }
        );
    } catch (error) {
        logger.error('Error retrieving trending dishes', { cuisineTypes, error: error.message });
        throw error;
    }
}));

module.exports = router;
