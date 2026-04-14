
const Database = require('./src/utils/Database');

async function checkAndLink() {
    try {
        await Database.initializePool();
        const users = await Database.query("SELECT user_id, user_name FROM user WHERE role = 'delivery'");
        console.log('Delivery Users:', users);

        const partners = await Database.query("SELECT id, name, user_id FROM delivery_partners");
        console.log('Partners:', partners);

        // Link 'roni' if not linked
        await Database.query("UPDATE delivery_partners SET user_id = 6 WHERE name = 'roni' AND user_id IS NULL");
        console.log('✅ Checked and linked roni');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAndLink();
