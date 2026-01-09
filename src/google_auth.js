const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

// Path to credentials and token
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Scopes for Sheets API
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
];

/**
 * Load credentials and start authentication flow
 */
async function authorize() {
    let content;
    try {
        content = fs.readFileSync(CREDENTIALS_PATH);
    } catch (err) {
        console.error('Error loading credentials.json:', err);
        console.error('Please ensure credentials.json is in the root scratch directory.');
        return;
    }

    const credentials = JSON.parse(content);
    // Support both 'installed' and 'web' types, though we expect 'web' here based on checks
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    // For CLI usage with 'web' credentials, we often need a specific redirect URI.
    // If redirect_uris is present, use the first one. Otherwise default to localhost.
    const redirectUri = (redirect_uris && redirect_uris[0]) || 'http://localhost';

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

    // Check if we already have a token
    try {
        const token = fs.readFileSync(TOKEN_PATH);
        oAuth2Client.setCredentials(JSON.parse(token));
        console.log('Already authenticated! Token loaded from', TOKEN_PATH);
        return oAuth2Client;
    } catch (err) {
        return getNewToken(oAuth2Client);
    }
}

/**
 * Get and store new token after prompting for user authorization.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
/**
 * Get and store new token after prompting for user authorization.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        console.log('Authorize this app by visiting this url:');
        console.log('--------------------------------------------------');
        console.log(authUrl);
        console.log('--------------------------------------------------');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    console.error('Error while trying to retrieve access token', err);
                    reject(err);
                    return;
                }
                oAuth2Client.setCredentials(token);
                // Store the token to disk for later program executions
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                console.log('Token stored to', TOKEN_PATH);
                resolve(oAuth2Client);
            });
        });
    });
}

if (require.main === module) {
    authorize();
}

module.exports = { authorize };
