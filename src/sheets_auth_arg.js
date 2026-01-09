const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
];

async function authorize(code) {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const redirectUri = (redirect_uris && redirect_uris[0]) || 'http://localhost';

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

    if (!code) {
        console.log('Usage: node sheets_auth_arg.js <AUTH_CODE>');
        return;
    }

    oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('Token stored to', TOKEN_PATH);
    });
}

const args = process.argv.slice(2);
authorize(args[0]);
