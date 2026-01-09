const { google } = require('googleapis');
const { authorize } = require('./google_auth');

/**
 * Returns a ready-to-use Google Sheets API client
 */
async function getSheetsClient() {
    const auth = await authorize();
    if (!auth) {
        throw new Error('Authentication failed or was cancelled.');
    }
    return google.sheets({ version: 'v4', auth });
}

/**
 * Creates a new spreadsheet
 * @param {string} title
 */
async function createSpreadsheet(title) {
    const sheets = await getSheetsClient();
    const resource = {
        properties: {
            title,
        },
    };
    const response = await sheets.spreadsheets.create({
        resource,
        fields: 'spreadsheetId',
    });
    return response.data.spreadsheetId;
}

module.exports = { getSheetsClient, createSpreadsheet };
