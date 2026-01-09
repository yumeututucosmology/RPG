const { getSheetsClient } = require('./sheets_client');

const SPREADSHEET_ID = process.argv[2];
const SHEET_NAME = 'フィールド操作';

async function verifyControls() {
    if (!SPREADSHEET_ID) {
        console.error('Please provide SPREADSHEET_ID');
        process.exit(1);
    }

    const sheets = await getSheetsClient();
    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        console.log('Available Sheets:');
        meta.data.sheets.forEach(s => console.log(`- ${s.properties.title}`));

        const targetSheet = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
        if (!targetSheet) {
            console.error(`Sheet "${SHEET_NAME}" not found!`);
            return;
        }

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!A:E`,
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return;
        }

        console.log(`--- ${SHEET_NAME} Content ---`);
        rows.forEach((row, i) => {
            console.log(`${i}: ${row.join(' | ')}`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

verifyControls();
