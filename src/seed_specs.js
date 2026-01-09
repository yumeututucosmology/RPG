const { getSheetsClient } = require('./sheets_client');

const SPREADSHEET_ID = process.argv[2];

if (!SPREADSHEET_ID) {
    console.log('Usage: node src/seed_specs.js <SPREADSHEET_ID>');
    process.exit(1);
}

const SPEC_SHEET = 'Specs';
const TASK_SHEET = 'Tasks';

async function seedSpecs() {
    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = meta.data.sheets.map(s => s.properties.title);

    const requests = [];

    // Create Specs Sheet if missing
    if (!existingSheets.includes(SPEC_SHEET)) {
        requests.push({ addSheet: { properties: { title: SPEC_SHEET } } });
    }
    // Create Tasks Sheet if missing
    if (!existingSheets.includes(TASK_SHEET)) {
        requests.push({ addSheet: { properties: { title: TASK_SHEET } } });
    }

    if (requests.length > 0) {
        console.log('Creating new sheets...');
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests }
        });
    }

    // Populate Specs
    const specsData = [
        ['カテゴリ', '項目', '説明', 'ステータス'],
        ['操作', 'WASD / 矢印キー', 'プレイヤー移動', '実装済み'],
        ['操作', 'Rキー', 'キャラクター切り替え', '実装済み'],
        ['操作', 'Space / Z', '決定 / ダッシュ', '実装済み'],
        ['システム', 'データロード', 'スプレッドシートからアイテム読み込み', '実装済み'],
        ['システム', 'ダブル主人公', '二人のキャラクターを操作可能', '実装済み'],
        ['グラフィック', '解像度', 'ドット絵の拡大処理', '作業中'],
    ];

    console.log('Writing Specs...');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SPEC_SHEET}!A1`,
        valueInputOption: 'RAW',
        resource: { values: specsData }
    });

    // Populate Tasks
    const tasksData = [
        ['ID', 'カテゴリ', 'タスク名', '担当者', 'ステータス', '優先度'],
        ['1', 'データ', '敵データのシート作成', '夢現氏', '未着手', '高'],
        ['2', 'システム', '敵読み込み処理の実装', 'おじさん', '未着手', '高'],
        ['3', 'UI', 'インベントリ画面の作成', 'おじさん', '未着手', '中'],
        ['4', 'シナリオ', '会話スクリプトの執筆', '夢現氏', '未着手', '低'],
    ];

    console.log('Writing Tasks...');
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${TASK_SHEET}!A1`,
        valueInputOption: 'RAW',
        resource: { values: tasksData }
    });

    console.log('Specs & Tasks seeding completed!');
}

seedSpecs();
