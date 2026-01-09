const { google } = require('googleapis');
const { authorize } = require('./google_auth');
const fs = require('fs');

/**
 * Get Google Drive Service
 */
async function getDriveService() {
    const auth = await authorize();
    return google.drive({ version: 'v3', auth });
}

/**
 * List files in Google Drive
 */
async function listFiles() {
    const drive = await getDriveService();
    const res = await drive.files.list({
        pageSize: 10,
        fields: 'nextPageToken, files(id, name)',
    });
    const files = res.data.files;
    if (files.length) {
        console.log('Files:');
        files.map((file) => {
            console.log(`${file.name} (${file.id})`);
        });
    } else {
        console.log('No files found.');
    }
    return files;
}

/**
 * Upload a file to Google Drive
 * @param {string} filePath Local path to the file
 * @param {string} mimeType Mime type of the file
 * @param {string} [fileName] Optional name for the file in Drive
 */
async function uploadFile(filePath, mimeType, fileName) {
    const drive = await getDriveService();
    const fileMetadata = {
        name: fileName || filePath.split('/').pop(),
    };
    const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath),
    };
    try {
        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });
        console.log('File Id:', file.data.id);
        return file.data.id;
    } catch (err) {
        console.error('Upload failed:', err);
        throw err;
    }
}

module.exports = { listFiles, uploadFile, getDriveService };
