
const Database = require('./src/utils/Database');
const Logger = require('./src/utils/Logger');

const logger = new Logger('Migration');

async function migrate() {
    try {
        await Database.initializePool();
        logger.info('Starting database migration...');

        // 1. Add user_id and city to delivery_partners if they don't exist
        const alterDeliveryPartners = [
            "ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS user_id INT(11) AFTER id",
            "ALTER TABLE delivery_partners ADD COLUMN IF NOT EXISTS city VARCHAR(100) AFTER vehicle_number",
            "ALTER TABLE delivery_partners MODIFY COLUMN status ENUM('available', 'busy', 'offline') DEFAULT 'offline'"
        ];

        for (const sql of alterDeliveryPartners) {
            try {
                await Database.query(sql);
                logger.info(`Executed: ${sql}`);
            } catch (e) {
                logger.warn(`Skipped or failed (might already exist): ${sql}`, { error: e.message });
            }
        }

        // 2. Add delivery_charges and city to orders if they don't exist
        const alterOrders = [
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(100) AFTER delivery_address",
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charges DECIMAL(10, 2) DEFAULT 0.00 AFTER total_amount"
        ];

        for (const sql of alterOrders) {
            try {
                await Database.query(sql);
                logger.info(`Executed: ${sql}`);
            } catch (e) {
                logger.warn(`Skipped or failed (might already exist): ${sql}`, { error: e.message });
            }
        }

        // 3. Update existing delivery partners if any to have a user_id (optional but good for consistency)
        // If there's only one delivery partner 'roni' from SQL dump, we can link it manually for testing
        // Roni in 'user' table has id 6.
        try {
            await Database.query("UPDATE delivery_partners SET user_id = 6 WHERE name = 'roni' AND user_id IS NULL");
            logger.info("Linked partner 'roni' to user_id 6");
        } catch (e) {}

        logger.info('✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Migration failed', { error: error.message });
        process.exit(1);
    }
}

migrate();
