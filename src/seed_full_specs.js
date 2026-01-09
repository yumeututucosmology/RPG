const { getSheetsClient } = require('./sheets_client');

const SHEET_TITLE = 'フィールド操作';

async function seedFieldControls() {
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

        // Prepare Data with Checkbox Column (A)
        const updateData = [
            ['実装済み', 'ボタン名', 'キーボード（デフォルト）', 'コントローラー', 'アクション', '説明', '備考'],
            ['TRUE', 'Up', 'ArrowUp / W', 'D-Pad Up', '上移動', 'キャラクターを上に移動させる', ''],
            ['TRUE', 'Down', 'ArrowDown / S', 'D-Pad Down', '下移動', 'キャラクターを下に移動させる', ''],
            ['TRUE', 'Left', 'ArrowLeft / A', 'D-Pad Left', '左移動', 'キャラクターを左に移動させる', ''],
            ['TRUE', 'Right', 'ArrowRight / D', 'D-Pad Right', '右移動', 'キャラクターを右に移動させる', ''],
            ['TRUE', 'A', 'Enter', 'B Button', '決定 / 会話 / 調べる', '決定ボタン、または目の前のオブジェクトに対するインタラクション', ''],
            ['FALSE', 'B', 'Shift', 'A Button', '攻撃', 'フィールド上で攻撃を行う（未実装）', ''],
            ['TRUE', 'R', 'E', 'R Button', 'キャラクター切り替え', '操作キャラクターを切り替える', ''],
            ['FALSE', 'L', 'Q', 'L Button', '攻撃変更', '攻撃方法を切り替える（実装予定）', ''],
            ['TRUE', 'Select', 'Escape', 'Back / View', 'メニュー', 'メニュー画面を開く', ''],
            ['TRUE', 'Start', 'Backspace', 'Start / Menu', 'ポーズ / スタート', 'ゲームを一時停止する', '']
        ];

        console.log('Updating field controls data...');

        // 1. Clear existing data to ensure column alignment
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${SHEET_TITLE}!A:Z`,
        });

        // 2. Write new data
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_TITLE}!A1`,
            valueInputOption: 'USER_ENTERED', // Needed for booleans to be recognized potentially, though RAW works too usually. USER_ENTERED is safer for checkboxes processing visually.
            resource: { values: updateData }
        });

        // 3. Add Checkbox Validation to Column A
        // We need sheetId for this
        const updatedMeta = await sheets.spreadsheets.get({ spreadsheetId });
        const targetSheet = updatedMeta.data.sheets.find(s => s.properties.title === SHEET_TITLE);

        if (targetSheet) {
            console.log('Adding checkboxes...');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [
                        {
                            setDataValidation: {
                                range: {
                                    sheetId: targetSheet.properties.sheetId,
                                    startRowIndex: 1, // Skip header
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
                        // 2. Format cells (Wrap text + Align Top)
                        {
                            repeatCell: {
                                range: {
                                    sheetId: targetSheet.properties.sheetId,
                                    startRowIndex: 0,
                                },
                                cell: {
                                    userEnteredFormat: {
                                        wrapStrategy: 'WRAP',
                                        verticalAlignment: 'TOP'
                                    }
                                },
                                fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
                            }
                        },
                        // 3. Set Column Widths (Optional: making Description/Remarks wider)
                        {
                            updateDimensionProperties: {
                                range: {
                                    sheetId: targetSheet.properties.sheetId,
                                    dimension: 'COLUMNS',
                                    startIndex: 5, // Description
                                    endIndex: 7    // Remarks + 1
                                },
                                properties: {
                                    pixelSize: 300
                                },
                                fields: 'pixelSize'
                            }
                        }
                    ]
                }
            });
        }

        console.log('Field Controls updated successfully!');

    } catch (err) {
        console.error('Error updating controls:', err);
    }
}

seedFieldControls();
