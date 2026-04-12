/**
 * FOODIO API - Thali Service
 * Business logic for thali operations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');
const config = require('../config/config');

const logger = new Logger('ThaliService');

class ThaliService {
    /**
     * Get all thalis
     */
    static async getAllThalis(page = 1, limit = 10) {
        try {
            const cacheKey = `thalis:list:${page}:${limit}`;
            const cached = await Cache.get(cacheKey);
            if (cached) return JSON.parse(cached);

            const offset = (page - 1) * limit;

            const query = `
                SELECT * FROM thali
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) as total FROM thali`;

            const [thalis, countResult] = await Promise.all([
                Database.query(query, [parseInt(limit), offset]),
                Database.query(countQuery),
            ]);

            const total = countResult[0]?.total || thalis.length || 0;

            const response = {
                thalis,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };

            // Cache for 10 minutes
            await Cache.set(cacheKey, response, 600);

            return response;
        } catch (error) {
            logger.error('getAllThalis error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get thali by ID
     */
    static async getThaliById(id) {
        try {
            const cacheKey = `thali:${id}`;
            const cached = await Cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const query = `SELECT * FROM thali WHERE thali_id = ?`;
            const result = await Database.queryOne(query, [id]);

            if (result) {
                await Cache.set(cacheKey, result, 1800);
            }

            return result;
        } catch (error) {
            logger.error('getThaliById error', { id, error: error.message });
            throw error;
        }
    }

    /**
     * Get thali dishes
     */
    static async getThaliDishes(thaliId) {
        try {
            const query = `
                SELECT * FROM thali_dishes WHERE thali_id = ?
            `;

            const dishes = await Database.query(query, [thaliId]);

            return dishes;
        } catch (error) {
            logger.error('getThaliDishes error', { thaliId, error: error.message });
            throw error;
        }
    }

    /**
     * Create thali
     */
    static async createThali(data) {
        try {
            const { thali_name, thali_price, thali_description, thali_image } = data;

            const query = `
                INSERT INTO thali (
                    thali_name,
                    thali_price,
                    thali_description,
                    thali_image,
                    created_at
                ) VALUES (?, ?, ?, ?, NOW())
            `;

            const result = await Database.query(query, [
                thali_name,
                thali_price,
                thali_description,
                thali_image,
            ]);

            await Cache.del('thali:*');

            logger.info('Thali created', { id: result.insertId });

            return { id: result.insertId, ...data };
        } catch (error) {
            logger.error('createThali error', { error: error.message });
            throw error;
        }
    }

    /**
     * Update thali
     */
    static async updateThali(id, data) {
        try {
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
                UPDATE thali
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = ?
            `;

            const result = await Database.query(query, updateValues);

            if (result.affectedRows === 0) {
                return null;
            }

            await Cache.del(`thali:${id}`);

            return await this.getThaliById(id);
        } catch (error) {
            logger.error('updateThali error', { id, error: error.message });
            throw error;
        }
    }

    /**
     * Delete thali
     */
    static async deleteThali(id) {
        try {
            const query = `DELETE FROM thali WHERE id = ?`;

            const result = await Database.query(query, [id]);

            if (result.affectedRows === 0) {
                return null;
            }

            await Cache.del(`thali:${id}`);

            logger.info('Thali deleted', { id });

            return true;
        } catch (error) {
            logger.error('deleteThali error', { id, error: error.message });
            throw error;
        }
    }
}

module.exports = ThaliService;
