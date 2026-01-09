const { getSheetsClient } = require('./sheets_client');

async function test(spreadsheetId) {
    try {
        const sheets = await getSheetsClient();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'A1:B5',
        });
        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
        } else {
            console.log('Name, Major:');
            rows.forEach((row) => {
                console.log(`${row[0]}, ${row[1]}`);
            });
        }
    } catch (err) {
        console.error('The API returned an error: ' + err);
    }
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('Usage: node src/test_sheets.js <SPREADSHEET_ID>');
} else {
    test(args[0]);
}
