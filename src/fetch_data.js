const { getSheetsClient } = require('./sheets_client');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = process.argv[2];

if (!SPREADSHEET_ID) {
    console.log('Usage: node src/fetch_data.js <SPREADSHEET_ID>');
    process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function fetchData() {
    const sheets = await getSheetsClient();

    try {
        // Define sheets to fetch
        const sheetsToFetch = ['Items', 'Specs'];

        for (const sheetName of sheetsToFetch) {
            console.log(`Fetching ${sheetName}...`);
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:E`, // Adjust range as needed, or use just SheetName for all
            });

            const rows = res.data.values;
            if (!rows || rows.length < 2) {
                console.log(`No data found in ${sheetName}.`);
                continue;
            }

            // Convert to array of objects
            const headers = rows[0];
            const data = rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    // Basic type inference could go here, but keeping it string for now
                    obj[header] = row[index] || "";
                });
                return obj;
            });

            const outputPath = path.join(OUTPUT_DIR, `${sheetName.toLowerCase()}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
            console.log(`Saved ${data.length} items to ${outputPath}`);
        }

    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

fetchData();
