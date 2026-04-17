/**
 * FOODIO API - Menu Service
 * Business logic for menu items operations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');
const config = require('../config/config');

const logger = new Logger('MenuService');

class MenuService {
    /**
     * Get all menu items by type
     */
    static async getMenuItems(type, page = 1, limit = 10) {
        try {
            const cacheKey = `menu:${type}:list:${page}:${limit}`;
            const cached = await Cache.get(cacheKey);
            if (cached) return JSON.parse(cached);

            const offset = (page - 1) * limit;
            const tableName = `${type.toLowerCase()}menu`;

            const query = `
                SELECT * FROM ${tableName}
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;

            const [items, countResult] = await Promise.all([
                Database.query(query, [parseInt(limit), offset]),
                Database.query(countQuery),
            ]);

            const total = countResult[0]?.total || 0;

            const response = {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };

            // Cache menu page results for 1 week
            await Cache.set(cacheKey, response, 604800);

            return response;
        } catch (error) {
            logger.error('getMenuItems error', { type, error: error.message });
            throw error;
        }
    }

    /**
     * Get menu item by ID
     */
    static async getMenuItemById(type, id) {
        try {
            // Check cache first
            const cacheKey = `menu:${type}:${id}`;
            const cached = await Cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            const tableName = `${type.toLowerCase()}menu`;
            const query = `SELECT * FROM ${tableName} WHERE dish_id = ?`;

            const result = await Database.queryOne(query, [id]);

            if (result) {
                await Cache.set(cacheKey, result, 1800);
            }

            return result;
        } catch (error) {
            logger.error('getMenuItemById error', { type, id, error: error.message });
            throw error;
        }
    }

    /**
     * Create menu item
     */
    static async createMenuItem(type, data) {
        try {
            const {
                item_name,
                item_price,
                item_description,
                item_type,
                item_category,
                item_image,
            } = data;

            const tableName = `${type.toLowerCase()}menu`;

            const query = `
                INSERT INTO ${tableName} (
                    item_name,
                    item_price,
                    item_description,
                    item_type,
                    item_category,
                    item_image,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            const result = await Database.query(query, [
                item_name,
                item_price,
                item_description,
                item_type,
                item_category,
                item_image,
            ]);

            await Cache.del(`menu:${type}:*`);

            logger.info('Menu item created', { type, id: result.insertId });

            return { id: result.insertId, ...data };
        } catch (error) {
            logger.error('createMenuItem error', { type, error: error.message });
            throw error;
        }
    }

    /**
     * Update menu item
     */
    static async updateMenuItem(type, id, data) {
        try {
            const tableName = `${type.toLowerCase()}menu`;

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

            await Cache.del(`menu:${type}:${id}`);

            return await this.getMenuItemById(type, id);
        } catch (error) {
            logger.error('updateMenuItem error', { type, id, error: error.message });
            throw error;
        }
    }

    /**
     * Delete menu item
     */
    static async deleteMenuItem(type, id) {
        try {
            const tableName = `${type.toLowerCase()}menu`;

            const query = `DELETE FROM ${tableName} WHERE id = ?`;

            const result = await Database.query(query, [id]);

            if (result.affectedRows === 0) {
                return null;
            }

            await Cache.del(`menu:${type}:${id}`);

            logger.info('Menu item deleted', { type, id });

            return true;
        } catch (error) {
            logger.error('deleteMenuItem error', { type, id, error: error.message });
            throw error;
        }
    }

    /**
     * Get items by category
     */
    static async getItemsByCategory(type, category, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            const tableName = `${type.toLowerCase()}menu`;

            const query = `
                SELECT * FROM ${tableName}
                WHERE item_category = ?
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) as total FROM ${tableName}
                WHERE item_category = ?
            `;

            const [items, countResult] = await Promise.all([
                Database.query(query, [category, parseInt(limit), offset]),
                Database.query(countQuery, [category]),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('getItemsByCategory error', { type, category, error: error.message });
            throw error;
        }
    }

    /**
     * Search menu items
     */
    static async searchItems(type, searchTerm, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            const tableName = `${type.toLowerCase()}menu`;
            const search = `%${searchTerm}%`;

            const query = `
                SELECT * FROM ${tableName}
                WHERE item_name LIKE ? OR item_description LIKE ?
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) as total FROM ${tableName}
                WHERE item_name LIKE ? OR item_description LIKE ?
            `;

            const [items, countResult] = await Promise.all([
                Database.query(query, [search, search, parseInt(limit), offset]),
                Database.query(countQuery, [search, search]),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('searchItems error', { type, searchTerm, error: error.message });
            throw error;
        }
    }

    /**
     * Filter items by price range
     */
    static async filterByPrice(type, minPrice, maxPrice, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;
            const tableName = `${type.toLowerCase()}menu`;

            const query = `
                SELECT * FROM ${tableName}
                WHERE item_price BETWEEN ? AND ?
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) as total FROM ${tableName}
                WHERE item_price BETWEEN ? AND ?
            `;

            const [items, countResult] = await Promise.all([
                Database.query(query, [minPrice, maxPrice, parseInt(limit), offset]),
                Database.query(countQuery, [minPrice, maxPrice]),
            ]);

            const total = countResult[0]?.total || 0;

            return {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('filterByPrice error', { type, minPrice, maxPrice, error: error.message });
            throw error;
        }
    }

    /**
     * Search across all menu types (veg, nonveg, southindian)
     */
    static async searchAcrossAll(searchTerm, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            const search = `%${searchTerm}%`;

            const query = `
                SELECT 'veg' as cuisine_type, dish_id, dish_name, dish_price, dish_rating,
                       dish_description, dish_image, restaurant_id
                FROM vegmenu
                WHERE dish_name LIKE ? OR dish_description LIKE ?
                UNION ALL
                SELECT 'nonveg' as cuisine_type, dish_id, dish_name, dish_price, dish_rating,
                       dish_description, dish_image, restaurant_id
                FROM nonvegmenu
                WHERE dish_name LIKE ? OR dish_description LIKE ?
                UNION ALL
                SELECT 'southindian' as cuisine_type, dish_id, dish_name, dish_price, dish_rating,
                       dish_description, dish_image, restaurant_id
                FROM southindianmenu
                WHERE dish_name LIKE ? OR dish_description LIKE ?
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) as total FROM (
                    SELECT 1 FROM vegmenu
                    WHERE dish_name LIKE ? OR dish_description LIKE ?
                    UNION ALL
                    SELECT 1 FROM nonvegmenu
                    WHERE dish_name LIKE ? OR dish_description LIKE ?
                    UNION ALL
                    SELECT 1 FROM southindianmenu
                    WHERE dish_name LIKE ? OR dish_description LIKE ?
                ) as combined_search
            `;

            const [items, countResult] = await Promise.all([
                Database.query(query, [search, search, search, search, search, search, parseInt(limit), offset]),
                Database.query(countQuery, [search, search, search, search, search, search]),
            ]);

            const total = countResult[0]?.total || 0;

            logger.info('Global search completed', { searchTerm, results: items.length, total });

            return {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('searchAcrossAll error', { searchTerm, error: error.message });
            throw error;
        }
    }

    /**
     * Advanced filter with optional search across all menu types
     */
    static async filterAdvanced(filters = {}, page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            const {
                cuisineTypes = ['veg', 'nonveg', 'southindian'],
                minPrice = null,
                maxPrice = null,
                minRating = null,
                restaurantId = null,
                searchTerm = null,
            } = filters;

            // Prepare parameters for the query
            const params = [];

            // Build WHERE clause and collect parameters
            const buildWhereClause = () => {
                const conditions = [];

                if (searchTerm) {
                    const search = `%${searchTerm}%`;
                    conditions.push(`(dish_name LIKE ? OR dish_description LIKE ?)`);
                    // Add search params twice (for LIKE in both columns)
                }

                if (minPrice !== null) {
                    conditions.push(`dish_price >= ?`);
                }

                if (maxPrice !== null) {
                    conditions.push(`dish_price <= ?`);
                }

                if (minRating !== null) {
                    conditions.push(`dish_rating >= ?`);
                }

                if (restaurantId !== null) {
                    conditions.push(`restaurant_id = ?`);
                }

                return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            };

            // Build parameter array based on filters
            const addParams = () => {
                if (searchTerm) {
                    const search = `%${searchTerm}%`;
                    params.push(search, search);
                }
                if (minPrice !== null) params.push(parseFloat(minPrice));
                if (maxPrice !== null) params.push(parseFloat(maxPrice));
                if (minRating !== null) params.push(parseFloat(minRating));
                if (restaurantId !== null) params.push(parseInt(restaurantId));
            };

            const whereClause = buildWhereClause();
            addParams();

            // Build UNION query for selected cuisine types
            const queryParts = [];
            cuisineTypes.forEach((cuisineType) => {
                const tableName = `${cuisineType.toLowerCase()}menu`;
                queryParts.push(
                    `SELECT '${cuisineType}' as cuisine_type, dish_id, dish_name, dish_price,
                            dish_rating, dish_description, dish_image, restaurant_id
                     FROM ${tableName} ${whereClause}`
                );
            });

            // For pagination, we need separate queries for each cuisine type
            const countQueryParts = queryParts.map(part => `${part}`);

            // Execute filtered query with pagination
            const query = `${queryParts.join(' UNION ALL ')} LIMIT ? OFFSET ?`;
            const countQuery = `SELECT COUNT(*) as total FROM (${countQueryParts.join(' UNION ALL ')}) as combined_filter`;

            // Add limit and offset to search params
            const queryParams = [...params, parseInt(limit), offset];
            const countParams = [...params];

            const [items, countResult] = await Promise.all([
                Database.query(query, queryParams),
                Database.query(countQuery, countParams),
            ]);

            const total = countResult[0]?.total || 0;

            logger.info('Advanced filter completed', { filters, results: items.length, total });

            return {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            };
        } catch (error) {
            logger.error('filterAdvanced error', { filters, error: error.message });
            throw error;
        }
    }

    /**
     * Get suggestions for autocomplete
     */
    static async getSearchSuggestions(prefix, limit = 10) {
        try {
            const search = `${prefix}%`;

            const query = `
                SELECT DISTINCT dish_name FROM (
                    SELECT dish_name FROM vegmenu
                    WHERE dish_name LIKE ?
                    UNION
                    SELECT dish_name FROM nonvegmenu
                    WHERE dish_name LIKE ?
                    UNION
                    SELECT dish_name FROM southindianmenu
                    WHERE dish_name LIKE ?
                ) as all_dishes
                ORDER BY dish_name
                LIMIT ?
            `;

            const suggestions = await Database.query(query, [search, search, search, parseInt(limit)]);

            logger.info('Search suggestions retrieved', { prefix, count: suggestions.length });

            return suggestions.map(item => item.dish_name);
        } catch (error) {
            logger.error('getSearchSuggestions error', { prefix, error: error.message });
            throw error;
        }
    }

    /**
     * Get trending dishes (highest rated)
     */
    static async getTrendingDishes(cuisineTypes = ['veg', 'nonveg', 'southindian'], limit = 10, minRating = 4.0) {
        try {
            // Build UNION query for selected cuisine types
            const queryParts = [];
            cuisineTypes.forEach((cuisineType) => {
                const tableName = `${cuisineType.toLowerCase()}menu`;
                queryParts.push(
                    `SELECT '${cuisineType}' as cuisine_type, dish_id, dish_name, dish_price,
                            dish_rating, dish_description, dish_image, restaurant_id
                     FROM ${tableName}
                     WHERE dish_rating >= ${parseFloat(minRating)}`
                );
            });

            const query = `
                ${queryParts.join(' UNION ALL ')}
                ORDER BY dish_rating DESC, dish_name ASC
                LIMIT ?
            `;

            const trendingDishes = await Database.query(query, [parseInt(limit)]);

            logger.info('Trending dishes retrieved', { cuisineTypes, count: trendingDishes.length });

            return trendingDishes;
        } catch (error) {
            logger.error('getTrendingDishes error', { cuisineTypes, error: error.message });
            throw error;
        }
    }
}

module.exports = MenuService;
