
const Database = require('./src/utils/Database');
const Logger = require('./src/utils/Logger');

const logger = new Logger('MigrationFix');

async function migrate() {
    try {
        await Database.initializePool();
        logger.info('Starting manual database fix...');

        const tables = {
            delivery_partners: ['user_id', 'city'],
            orders: ['city', 'delivery_charges']
        };

        // Helper to check if column exists
        const columnExists = async (table, column) => {
            const rows = await Database.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
            return rows.length > 0;
        };

        // 1. Fix delivery_partners
        if (!(await columnExists('delivery_partners', 'user_id'))) {
            await Database.query("ALTER TABLE delivery_partners ADD COLUMN user_id INT(11) AFTER id");
            logger.info("Added user_id to delivery_partners");
        }
        if (!(await columnExists('delivery_partners', 'city'))) {
            await Database.query("ALTER TABLE delivery_partners ADD COLUMN city VARCHAR(100) AFTER vehicle_number");
            logger.info("Added city to delivery_partners");
        }
        await Database.query("ALTER TABLE delivery_partners MODIFY COLUMN status ENUM('available', 'busy', 'offline') DEFAULT 'offline'");

        // 2. Fix orders
        if (!(await columnExists('orders', 'city'))) {
            await Database.query("ALTER TABLE orders ADD COLUMN city VARCHAR(100) AFTER delivery_address");
            logger.info("Added city to orders");
        }
        if (!(await columnExists('orders', 'delivery_charges'))) {
            await Database.query("ALTER TABLE orders ADD COLUMN delivery_charges DECIMAL(10, 2) DEFAULT 0.00 AFTER total_amount");
            logger.info("Added delivery_charges to orders");
        }

        // 3. Fix phone column type in orders
        await Database.query("ALTER TABLE orders MODIFY COLUMN phone VARCHAR(20)");
        logger.info("Modified phone column to VARCHAR(20) in orders");

        logger.info('✅ Migration fix completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Migration fix failed', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

migrate();
