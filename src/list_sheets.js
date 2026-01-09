const { getSheetsClient } = require('./sheets_client');

const SPREADSHEET_ID = process.argv[2];

if (!SPREADSHEET_ID) {
    console.log('Usage: node src/list_sheets.js <SPREADSHEET_ID>');
    process.exit(1);
}

async function listSheets() {
    const sheets = await getSheetsClient();
    try {
        const res = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        
        console.log('Available Sheets:');
        res.data.sheets.forEach(sheet => {
            console.log(`- ${sheet.properties.title}`);
        });

    } catch (err) {
        console.error('Error listing sheets:', err);
    }
}

listSheets();
