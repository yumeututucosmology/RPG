const { getSheetsClient } = require('./sheets_client');

const SHEET_TITLE = 'フィールド特殊';

async function seedSpecialSpecs() {
    let spreadsheetId = process.argv[2];
    const sheets = await getSheetsClient();

    if (!spreadsheetId) {
        console.error('Spreadsheet ID is required.');
        process.exit(1);
    }

    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const existingSheets = meta.data.sheets.map(s => s.properties.title);
        const requests = [];

        // Create Sheet if missing
        if (!existingSheets.includes(SHEET_TITLE)) {
            console.log(`Creating sheet: ${SHEET_TITLE}...`);
            requests.push({ addSheet: { properties: { title: SHEET_TITLE } } });
        }

        if (requests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests }
            });
        }

        // Prepare Data
        const header = ['実装済み', 'アクション名称', '操作方法', '発動条件', '効果・挙動', '備考'];
        const values = [
            header,
            ['TRUE', 'ダッシュ', '方向キー2回押し（ダブルタップ）', '移動操作時', '移動速度が通常よりも上昇する。探索効率が上がるが、微調整は難しくなる。', '実装済み'],
            ['FALSE', '別行動', 'R Button長押し', '通常時（フォロワーがいる場合）', 'パートナーキャラクターとの連携を一時解除し、単独で行動できるようにする。', '']
        ];

        console.log(`Updating ${SHEET_TITLE} data...`);

        // 1. Clear existing data
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${SHEET_TITLE}!A:Z`,
        });

        // 2. Write new data
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_TITLE}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });

        // 3. Formatting
        const updatedMeta = await sheets.spreadsheets.get({ spreadsheetId });
        const targetSheet = updatedMeta.data.sheets.find(s => s.properties.title === SHEET_TITLE);

        if (targetSheet) {
            console.log('Applying formatting...');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [
                        // Checkbox for "Implemented" column
                        {
                            setDataValidation: {
                                range: {
                                    sheetId: targetSheet.properties.sheetId,
                                    startRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 1
                                },
                                rule: {
                                    condition: { type: 'BOOLEAN' },
                                    showCustomUi: true,
                                    strict: true
                                }
                            }
                        },
                        // Header formatting (Bold, Frozen Row)
                        {
                            repeatCell: {
                                range: {
                                    sheetId: targetSheet.properties.sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: { bold: true },
                                        horizontalAlignment: 'CENTER'
                                    }
                                },
                                fields: 'userEnteredFormat(textFormat,horizontalAlignment)'
                            }
                        },
                        {
                            updateSheetProperties: {
                                properties: {
                                    sheetId: targetSheet.properties.sheetId,
                                    gridProperties: {
                                        frozenRowCount: 1
                                    }
                                },
                                fields: 'gridProperties.frozenRowCount'
                            }
                        },
                        // Column Widths
                        {
                            updateDimensionProperties: {
                                range: {
                                    sheetId: targetSheet.properties.sheetId,
                                    dimension: 'COLUMNS',
                                    startIndex: 4, // Effect
                                    endIndex: 6    // Notes + 1
                                },
                                properties: { pixelSize: 300 },
                                fields: 'pixelSize'
                            }
                        }
                    ]
                }
            });
        }

        console.log('Special Specs updated successfully!');

    } catch (err) {
        console.error('Error updating special specs:', err);
    }
}

seedSpecialSpecs();
