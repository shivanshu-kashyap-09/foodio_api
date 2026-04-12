/**
 * FOODIO API - Restaurant Service
 * Business logic for restaurant operations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');
const config = require('../config/config');

const logger = new Logger('RestaurantService');

class RestaurantService {
    /**
     * Get all restaurants with pagination
     */
    static async getAllRestaurants(type, page = 1, limit = 10) {
        try {
            const cacheKey = `restaurants:${type}:${page}:${limit}`;
            const cached = await Cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const offset = (page - 1) * limit;
            const tableName = `${type.toLowerCase()}restaurant`;

            const query = `
                SELECT * FROM ${tableName}
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;

            const [restaurants, countResult] = await Promise.all([
                Database.query(query, [parseInt(limit), offset]),
                Database.query(countQuery),
            ]);

            const total = countResult[0]?.total || restaurants.length || 0;

            const response = {
                restaurants,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };

            // Cache for 10 minutes
            await Cache.set(cacheKey, response, 600);

            return response;
        } catch (error) {
            logger.error('getAllRestaurants error', { type, error: error.message });
            throw error;
        }
    }

    /**
     * Get restaurant by ID
     */
    static async getRestaurantById(type, id) {
        try {
            // Check cache first
            const cacheKey = `restaurant:${type}:${id}`;
            const cached = await Cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const tableName = `${type.toLowerCase()}restaurant`;
            const query = `SELECT * FROM ${tableName} WHERE id = ?`;

            const result = await Database.queryOne(query, [id]);

            if (result) {
                // Cache for 30 minutes
                await Cache.set(cacheKey, result, 1800);
            }

            return result;
        } catch (error) {
            logger.error('getRestaurantById error', { type, id, error: error.message });
            throw error;
        }
    }

    /**
     * Create restaurant
     */
    static async createRestaurant(type, data) {
        try {
            const {
                restaurant_name,
                restaurant_phone,
                restaurant_address,
                restaurant_cuisine_type,
                restaurant_img,
            } = data;

            const tableName = `${type.toLowerCase()}restaurant`;

            const query = `
                INSERT INTO ${tableName} (
                    restaurant_name,
                    restaurant_phone,
                    restaurant_address,
                    restaurant_cuisine_type,
                    restaurant_img,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `;

            const result = await Database.query(query, [
                restaurant_name,
                restaurant_phone,
                restaurant_address,
                restaurant_cuisine_type,
                restaurant_img,
            ]);

            // Invalidate cache
            await Cache.del(`${type.toLowerCase()}:restaurants:*`);

            logger.info('Restaurant created', { type, id: result.insertId });

            return { id: result.insertId, ...data };
        } catch (error) {
            logger.error('createRestaurant error', { type, error: error.message });
            throw error;
        }
    }

    /**
     * Update restaurant
     */
    static async updateRestaurant(type, id, data) {
        try {
            const tableName = `${type.toLowerCase()}restaurant`;

            // Build dynamic update query
            const updateFields = [];
            const updateValues = [];

            Object.entries(data).forEach(([key, value]) => {
                if (value !== undefined && key !== 'id') {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(value);
                }
            });

            if (updateFields.length === 0) {
                return null;
            }

            updateValues.push(id);

            const query = `
                UPDATE ${tableName}
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = ?
            `;

            const result = await Database.query(query, updateValues);

            if (result.affectedRows === 0) {
                return null;
            }

            // Invalidate cache
            await Cache.del(`restaurant:${type}:${id}`);

            return await this.getRestaurantById(type, id);
        } catch (error) {
            logger.error('updateRestaurant error', { type, id, error: error.message });
            throw error;
        }
    }

    /**
     * Delete restaurant
     */
    static async deleteRestaurant(type, id) {
        try {
            const tableName = `${type.toLowerCase()}restaurant`;

            const query = `DELETE FROM ${tableName} WHERE id = ?`;

            const result = await Database.query(query, [id]);

            if (result.affectedRows === 0) {
                return null;
            }

            // Invalidate cache
            await Cache.del(`restaurant:${type}:${id}`);

            logger.info('Restaurant deleted', { type, id });

            return true;
        } catch (error) {
            logger.error('deleteRestaurant error', { type, id, error: error.message });
            throw error;
        }
    }

    /**
     * Search restaurants by name or cuisine
     */
    static async searchRestaurants(type, searchTerm, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            const tableName = `${type.toLowerCase()}restaurant`;
            const search = `%${searchTerm}%`;

            const query = `
                SELECT * FROM ${tableName}
                WHERE restaurant_name LIKE ?
                   OR restaurant_cuisine_type LIKE ?
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) as total FROM ${tableName}
                WHERE restaurant_name LIKE ?
                   OR restaurant_cuisine_type LIKE ?
            `;

            const [restaurants, countResult] = await Promise.all([
                Database.query(query, [search, search, parseInt(limit), offset]),
                Database.query(countQuery, [search, search]),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                restaurants,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('searchRestaurants error', { type, searchTerm, error: error.message });
            throw error;
        }
    }
}

module.exports = RestaurantService;
