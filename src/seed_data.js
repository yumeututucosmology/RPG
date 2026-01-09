const { getSheetsClient } = require('./sheets_client');

const SPREADSHEET_ID = process.argv[2];

if (!SPREADSHEET_ID) {
    console.log('Usage: node src/seed_data.js <SPREADSHEET_ID>');
    process.exit(1);
}

const ITEMS_SHEET_TITLE = 'Items';

async function seed() {
    const sheets = await getSheetsClient();

    try {
        // 1. Check if "Items" sheet exists
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        let sheetId = null;
        const itemsSheet = meta.data.sheets.find(s => s.properties.title === ITEMS_SHEET_TITLE);

        if (!itemsSheet) {
            console.log(`Creating sheet: ${ITEMS_SHEET_TITLE}...`);
            const addSheetRes = await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: ITEMS_SHEET_TITLE }
                        }
                    }]
                }
            });
            sheetId = addSheetRes.data.replies[0].addSheet.properties.sheetId;
        } else {
            console.log(`Sheet "${ITEMS_SHEET_TITLE}" already exists.`);
            sheetId = itemsSheet.properties.sheetId;
        }

        // 2. Clear existing data (optional, but good for seeding)
        // For safety, let's just overwrite cells starting A1

        // 3. Write Headers and Sample Data
        const values = [
            ['id', 'name', 'description', 'effect_type', 'effect_value'],
            ['potion_s', '回復薬（小）', 'HPを50回復する', 'heal', '50'],
            ['potion_m', '回復薬（中）', 'HPを150回復する', 'heal', '150'],
            ['sword_iron', '鉄の剣', 'ごく普通の鉄製の剣。', 'attack', '10'],
            ['shield_wood', '木の盾', '心もとない木製の盾。', 'defense', '5']
        ];

        console.log('Writing data...');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${ITEMS_SHEET_TITLE}!A1`,
            valueInputOption: 'RAW',
            resource: { values }
        });

        console.log('Seeding completed successfully!');

    } catch (err) {
        console.error('Error seeding data:', err);
    }
}

seed();
