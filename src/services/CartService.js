/**
 * FOODIO API - Cart Service
 * Business logic for shopping cart operations
 */

const Database = require('../utils/Database');
const Cache = require('../utils/Cache');
const Logger = require('../utils/Logger');

const logger = new Logger('CartService');

class CartService {
    /**
     * Get user cart
     */
    static async getCart(userId) {
        try {
            const query = `
                SELECT c.*, m.item_name, m.item_price
                FROM cart c
                JOIN vegmenu m ON c.item_id = m.id
                WHERE c.user_id = ?
                UNION ALL
                SELECT c.*, m.item_name, m.item_price
                FROM cart c
                JOIN nonvegmenu m ON c.item_id = m.id
                WHERE c.user_id = ?
                UNION ALL
                SELECT c.*, m.item_name, m.item_price
                FROM cart c
                JOIN southindianmenu m ON c.item_id = m.id
                WHERE c.user_id = ?
            `;

            const cartItems = await Database.query(query, [userId, userId, userId]);

            const total = cartItems.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);

            return {
                items: cartItems,
                total,
                itemCount: cartItems.length,
            };
        } catch (error) {
            logger.error('getCart error', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Add item to cart
     */
    static async addToCart(userId, itemId, quantity) {
        try {
            // Check if item already in cart
            const existingQuery = `
                SELECT id, quantity FROM cart
                WHERE user_id = ? AND item_id = ?
            `;

            const existing = await Database.queryOne(existingQuery, [userId, itemId]);

            if (existing) {
                // Update quantity
                const updateQuery = `
                    UPDATE cart
                    SET quantity = quantity + ?
                    WHERE user_id = ? AND item_id = ?
                `;

                await Database.query(updateQuery, [quantity, userId, itemId]);

                logger.info('Cart item quantity updated', { userId, itemId });

                return { itemId, quantity: existing.quantity + quantity };
            } else {
                // Add new item
                const insertQuery = `
                    INSERT INTO cart (user_id, item_id, quantity, created_at)
                    VALUES (?, ?, ?, NOW())
                `;

                const result = await Database.query(insertQuery, [userId, itemId, quantity]);

                logger.info('Item added to cart', { userId, itemId });

                return { id: result.insertId, itemId, quantity };
            }
        } catch (error) {
            logger.error('addToCart error', { userId, itemId, error: error.message });
            throw error;
        }
    }

    /**
     * Update cart item quantity
     */
    static async updateCartItem(userId, itemId, quantity) {
        try {
            if (quantity <= 0) {
                return await this.removeFromCart(userId, itemId);
            }

            const query = `
                UPDATE cart
                SET quantity = ?
                WHERE user_id = ? AND item_id = ?
            `;

            const result = await Database.query(query, [quantity, userId, itemId]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Cart item updated', { userId, itemId, quantity });

            return { itemId, quantity };
        } catch (error) {
            logger.error('updateCartItem error', { userId, itemId, error: error.message });
            throw error;
        }
    }

    /**
     * Remove item from cart
     */
    static async removeFromCart(userId, itemId) {
        try {
            const query = `
                DELETE FROM cart
                WHERE user_id = ? AND item_id = ?
            `;

            const result = await Database.query(query, [userId, itemId]);

            if (result.affectedRows === 0) {
                return null;
            }

            logger.info('Item removed from cart', { userId, itemId });

            return true;
        } catch (error) {
            logger.error('removeFromCart error', { userId, itemId, error: error.message });
            throw error;
        }
    }

    /**
     * Clear cart
     */
    static async clearCart(userId) {
        try {
            const query = `DELETE FROM cart WHERE user_id = ?`;

            await Database.query(query, [userId]);

            logger.info('Cart cleared', { userId });

            return true;
        } catch (error) {
            logger.error('clearCart error', { userId, error: error.message });
            throw error;
        }
    }
}

module.exports = CartService;
