// backend/services/cron.js
const cron = require('node-cron');
const { syncAllUsers } = require('./gameEngine');

function startCron() {
    console.log('[Cron] Scheduling hourly LeetCode auto-sync...');
    // Run at minute 0 of every hour
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Triggering scheduled sync for all users...');
        try {
            await syncAllUsers();
            console.log('[Cron] Scheduled sync completed successfully.');
        } catch (err) {
            console.error('[Cron] Error during scheduled sync:', err.message);
        }
    });
}

module.exports = {
    startCron
};
