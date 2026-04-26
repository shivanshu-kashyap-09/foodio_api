const Database = require('../utils/Database');
const Logger = require('../utils/Logger');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

const logger = new Logger('AdminService');

const config = require('../config/config');

class AdminService {
    constructor() {
        this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
        this.twilioPhone = config.twilio.phoneNumber;

        // Fallback or setup for nodemail
        this.emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.email.auth.user,
                pass: config.email.auth.pass
            }
        });
    }
    async getDashboardStats() {
        try {
            const revenueSql = "SELECT SUM(total_amount) as totalRevenue FROM orders WHERE status = 'Delivered'";
            const ordersSql = "SELECT COUNT(*) as totalOrders FROM orders";
            const usersSql = "SELECT COUNT(*) as totalUsers FROM user";
            const activeUsersSql = "SELECT COUNT(*) as activeUsers FROM user WHERE user_verify = 1";

            const revenue = await Database.queryOne(revenueSql);
            const orders = await Database.queryOne(ordersSql);
            const users = await Database.queryOne(usersSql);
            const activeUsers = await Database.queryOne(activeUsersSql);

            return {
                totalRevenue: revenue ? (revenue.totalRevenue || 0) : 0,
                totalOrders: orders ? orders.totalOrders : 0,
                totalUsers: users ? users.totalUsers : 0,
                activeUsers: activeUsers ? activeUsers.activeUsers : 0
            };
        } catch (error) {
            logger.error('Failed to fetch dashboard stats', { error: error.message });
            throw error;
        }
    }

    async getRevenueAnalytics() {
        try {
            const sql = `
                SELECT 
                    MONTHNAME(created_at) as month, 
                    SUM(total_amount) as revenue 
                FROM orders 
                WHERE status = 'Delivered' 
                AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY MONTH(created_at), MONTHNAME(created_at)
                ORDER BY MONTH(created_at) ASC
            `;
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch revenue analytics', { error: error.message });
            throw error;
        }
    }

    async getRecentOrders() {
        try {
            const sql = "SELECT * FROM orders ORDER BY order_id DESC LIMIT 10";
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch recent orders', { error: error.message });
            throw error;
        }
    }

    async getAllOrders() {
        try {
            const sql = "SELECT * FROM orders ORDER BY order_id DESC";
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch all orders', { error: error.message });
            throw error;
        }
    }

    async getRestaurantsForApproval() {
        try {
            // Check all restaurant tables
            const veg = await Database.query("SELECT *, 'veg' as type FROM vegrestaurant WHERE is_approved = 0");
            const nonVeg = await Database.query("SELECT *, 'nonveg' as type FROM nonvegrestaurant WHERE is_approved = 0");
            const south = await Database.query("SELECT *, 'southindian' as type FROM southindianrestaurant WHERE is_approved = 0");

            return [...veg, ...nonVeg, ...south];
        } catch (error) {
            logger.error('Failed to fetch restaurants for approval', { error: error.message });
            throw error;
        }
    }

    async getAllRestaurants() {
        try {
            // Check all restaurant tables independent of approval
            const veg = await Database.query("SELECT *, 'veg' as type FROM vegrestaurant");
            const nonVeg = await Database.query("SELECT *, 'nonveg' as type FROM nonvegrestaurant");
            const south = await Database.query("SELECT *, 'southindian' as type FROM southindianrestaurant");

            return [...veg, ...nonVeg, ...south];
        } catch (error) {
            logger.error('Failed to fetch all restaurants', { error: error.message });
            throw error;
        }
    }

    async approveRestaurant(type, id, status) {
        try {
            let table = '';
            if (type === 'veg') table = 'vegrestaurant';
            else if (type === 'nonveg') table = 'nonvegrestaurant';
            else if (type === 'southindian') table = 'southindianrestaurant';

            if (!table) throw new Error('Invalid restaurant type');

            // Fetch restaurant details for SMS
            const restaurant = await Database.query(`SELECT res_name, res_phone FROM ${table} WHERE res_id = ?`, [id]);

            const sql = `UPDATE ${table} SET is_approved = ? WHERE res_id = ?`;
            const result = await Database.query(sql, [status ? 1 : -1, id]); // 1 for approved, -1 for rejected

            // Send SMS via Twilio if restaurant is found and has a valid phone number
            if (restaurant && restaurant.length > 0 && restaurant[0].res_phone) {
                try {
                    // Try to normalize phone number to E.164 format if missing country code
                    let phoneStr = String(restaurant[0].res_phone).trim();
                    if (!phoneStr.startsWith('+')) {
                        // Assuming standard international prefix if missing
                        phoneStr = '+91' + phoneStr.replace(/^0+/, '');
                    }
                    
                    const msgBody = status 
                        ? `Congratulations! Your restaurant '${restaurant[0].res_name}' has been Approved on Foodio. You can now receive orders.`
                        : `We regret to inform you that your restaurant '${restaurant[0].res_name}' registration on Foodio has been Rejected. Please contact support.`;
                        
                    await this.twilioClient.messages.create({
                        body: msgBody,
                        from: this.twilioPhone,
                        to: phoneStr
                    });
                    logger.info(`Sent SMS to ${phoneStr} for restaurant approval status: ${status}`);
                } catch (smsError) {
                    logger.error('Twilio SMS sending failed', { error: smsError.message });
                    // Not throwing error to avoid interrupting the API response
                }
            }

            return result;
        } catch (error) {
            logger.error('Failed to approve/reject restaurant', { error: error.message });
            throw error;
        }
    }
    async getAllUsers() {
        try {
            const sql = "SELECT user_id, user_name, user_gmail, user_phone, user_address, created_at, user_verify, role FROM user WHERE role = 'user' OR role IS NULL ORDER BY user_id DESC";
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch users', { error: error.message });
            throw error;
        }
    }

    async blockUser(id, status) {
        try {
            const sql = "UPDATE user SET user_verify = ? WHERE user_id = ?";
            // status true means active (1), false means blocked (0)
            return await Database.query(sql, [status ? 1 : 0, id]);
        } catch (error) {
            logger.error('Failed to block/unblock user', { error: error.message });
            throw error;
        }
    }

    async getAllDeliveryAgents() {
        try {
            const sql = "SELECT dp.*, u.user_gmail FROM delivery_partners dp LEFT JOIN user u ON dp.user_id = u.user_id ORDER BY dp.id DESC";
            return await Database.query(sql);
        } catch (error) {
            logger.error('Failed to fetch delivery agents', { error: error.message });
            // return empty if tabel does not exist
            return [];
        }
    }

    async approveAgent(id, status) {
        try {
            // Get Agent details first
            const agent = await Database.query("SELECT name, phone, user_id FROM delivery_partners WHERE id = ?", [id]);
            
            const sql = "UPDATE delivery_partners SET status = ? WHERE id = ?";
            const result = await Database.query(sql, [status, id]);
            
            // Send SMS via Twilio if agent is found and has a valid phone number
            if (agent && agent.length > 0 && agent[0].phone) {
                try {
                    let phoneStr = String(agent[0].phone).trim();
                    if (!phoneStr.startsWith('+')) {
                        phoneStr = '+91' + phoneStr.replace(/^0+/, '');
                    }
                    
                    const msgBody = status === 'available' 
                        ? `Congratulations! Your Delivery Agent application for '${agent[0].name}' has been Approved on Foodio. You can now start delivering!`
                        : `Your Delivery Agent application for Foodio has been updated to: ${status}. Please check your portal for more details.`;
                        
                    await this.twilioClient.messages.create({
                        body: msgBody,
                        from: this.twilioPhone,
                        to: phoneStr
                    });
                    logger.info(`Sent SMS to ${phoneStr} for delivery agent status: ${status}`);

                    // Attempt Email Dispatch
                    const userEmail = await Database.query('SELECT user_gmail FROM user WHERE user_id = ?', [agent[0].user_id]);
                    if (userEmail && userEmail.length > 0 && userEmail[0].user_gmail) {
                        try {
                            await this.emailTransporter.sendMail({
                                from: '"Foodio Admin App" <admin@foodio.com>',
                                to: userEmail[0].user_gmail,
                                subject: 'Foodio Delivery Partner Application Update',
                                text: msgBody
                            });
                        } catch (err) {
                            logger.warn('Failed to send Mail, credential mock not complete.');
                        }
                    }

                } catch (smsError) {
                    logger.error('Twilio SMS sending failed', { error: smsError.message });
                }
            }

            return result;
        } catch (error) {
            logger.error('Failed to update agent status', { error: error.message });
            throw error;
        }
    }
}

module.exports = new AdminService();
