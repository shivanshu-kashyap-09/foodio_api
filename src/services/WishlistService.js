/**
 * FOODIO API - Wishlist Service
 * Business logic for wishlist operations
 */

const Database = require('../utils/Database');
const Logger = require('../utils/Logger');

const logger = new Logger('WishlistService');

class WishlistService {
    /**
     * Get user wishlist
     */
    static async getWishlist(userId, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;

            const query = `
                SELECT w.*, m.item_name, m.item_price, m.item_description
                FROM wishlist w
                JOIN vegmenu m ON w.item_id = m.id AND w.menu_type = 'veg'
                WHERE w.user_id = ?
                UNION ALL
                SELECT w.*, m.item_name, m.item_price, m.item_description
                FROM wishlist w
                JOIN nonvegmenu m ON w.item_id = m.id AND w.menu_type = 'nonveg'
                WHERE w.user_id = ?
                UNION ALL
                SELECT w.*, m.item_name, m.item_price, m.item_description
                FROM wishlist w
                JOIN southindianmenu m ON w.item_id = m.id AND w.menu_type = 'southindian'
                WHERE w.user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) as total FROM wishlist WHERE user_id = ?`;

            const [items, countResult] = await Promise.all([
                Database.query(query, [userId, userId, userId, parseInt(limit), offset]),
                Database.query(countQuery, [userId]),
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
            logger.error('getWishlist error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Add item to wishlist
     */
    static async addToWishlist(userId, itemId, menuType) {
        try {
            // Check if already in wishlist
            const existingQuery = `
                SELECT id FROM wishlist
                WHERE user_id = ? AND item_id = ? AND menu_type = ?
            `;

            const existing = await Database.queryOne(existingQuery, [userId, itemId, menuType]);

            if (existing) {
                logger.warn('Item already in wishlist', { userId, itemId, menuType });
                const error = new Error('Item already in wishlist');
                error.statusCode = 409;
                throw error;
            }

            const insertQuery = `
                INSERT INTO wishlist (user_id, item_id, menu_type, created_at)
                VALUES (?, ?, ?, NOW())
            `;

            const result = await Database.query(insertQuery, [userId, itemId, menuType]);

            logger.info('Item added to wishlist', { userId, itemId, menuType });

            return { id: result.insertId, itemId, menuType };
        } catch (error) {
            logger.error('addToWishlist error', { userId, itemId, error: error.message });
            throw error;
        }
    }

    /**
     * Remove item from wishlist
     */
    static async removeFromWishlist(userId, itemId) {
        try {
            const query = `
                DELETE FROM wishlist
                WHERE user_id = ? AND item_id = ?
            `;

            const result = await Database.query(query, [userId, itemId]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Item removed from wishlist', { userId, itemId });

            return true;
        } catch (error) {
            logger.error('removeFromWishlist error', { userId, itemId, error: error.message });
            throw error;
        }
    }

    /**
     * Check if item in wishlist
     */
    static async isInWishlist(userId, itemId) {
        try {
            const query = `
                SELECT id FROM wishlist
                WHERE user_id = ? AND item_id = ?
            `;

            const result = await Database.queryOne(query, [userId, itemId]);

            return result ? true : false;
        } catch (error) {
            logger.error('isInWishlist error', { userId, itemId, error: error.message });
            throw error;
        }
    }

    /**
     * Clear wishlist
     */
    static async clearWishlist(userId) {
        try {
            const query = `DELETE FROM wishlist WHERE user_id = ?`;

            await Database.query(query, [userId]);

            logger.info('Wishlist cleared', { userId });

            return true;
        } catch (error) {
            logger.error('clearWishlist error', { userId, error: error.message });
            throw error;
        }
    }
}

module.exports = WishlistService;
