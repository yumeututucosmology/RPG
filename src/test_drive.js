const { listFiles } = require('./drive_client');

(async () => {
    try {
        console.log('--- Google Drive Integration Test ---');
        console.log('Attempting to authenticate and list files...');

        await listFiles();

        console.log('--- Test Complete ---');
    } catch (error) {
        console.error('--- Test Failed ---');
        console.error(error);
    }
})();
