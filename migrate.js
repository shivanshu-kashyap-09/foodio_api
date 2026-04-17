const Database = require('./src/utils/Database');

async function migrate() {
    try {
        await Database.query("ALTER TABLE orders ADD COLUMN borzo_order_id VARCHAR(50) DEFAULT NULL, ADD COLUMN borzo_tracking_url VARCHAR(255) DEFAULT NULL;")
        console.log("Success add columns!");
    } catch(err) {
        console.log(err);
    }
    process.exit(0);
}
migrate();
