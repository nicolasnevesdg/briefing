const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { criarManipuladorApi } = require('./src/api');
const { executarBackupsSemanais } = require('./src/drive');

initializeApp();

const alexaOAuthClientSecret = defineSecret('ALEXA_OAUTH_CLIENT_SECRET');
const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
const whatsappAppSecret = defineSecret('WHATSAPP_APP_SECRET');
const whatsappAccessToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const googleDriveClientSecret = defineSecret('GOOGLE_DRIVE_CLIENT_SECRET');
const googleDriveEncryptionKey = defineSecret('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY');

const GOOGLE_DRIVE_CLIENT_ID = '626285959649-a7e0faqjb43psugsbmqt9ptfjo63nvp3.apps.googleusercontent.com';
const GOOGLE_DRIVE_REDIRECT_URI = 'https://southamerica-east1-guget-fin.cloudfunctions.net/api/v1/drive/oauth/callback';

setGlobalOptions({
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 10,
    concurrency: 40
});

const db = getFirestore();
const auth = getAuth();
const servicos = {
    db,
    auth,
    logger,
    getAlexaClientSecret: () => alexaOAuthClientSecret.value(),
    getWhatsAppVerifyToken: () => whatsappVerifyToken.value(),
    getWhatsAppAppSecret: () => whatsappAppSecret.value(),
    getWhatsAppAccessToken: () => whatsappAccessToken.value(),
    getGoogleDriveClientSecret: () => googleDriveClientSecret.value(),
    getGoogleDriveEncryptionKey: () => googleDriveEncryptionKey.value(),
    googleDriveClientId: GOOGLE_DRIVE_CLIENT_ID,
    googleDriveRedirectUri: GOOGLE_DRIVE_REDIRECT_URI,
    whatsAppPhoneNumberId: '1244702925390116',
    publicSiteUrl: 'https://nicolasneves.com.br/GUGETFIN'
};

const manipulador = criarManipuladorApi(servicos);

exports.api = onRequest({
    cors: false,
    secrets: [
        alexaOAuthClientSecret,
        whatsappVerifyToken,
        whatsappAppSecret,
        whatsappAccessToken,
        googleDriveClientSecret,
        googleDriveEncryptionKey
    ]
}, manipulador);

exports.driveWeeklyBackup = onSchedule({
    schedule: '0 3 * * 0',
    timeZone: 'America/Sao_Paulo',
    secrets: [googleDriveClientSecret, googleDriveEncryptionKey]
}, async () => {
    const resultado = await executarBackupsSemanais(servicos);
    logger.info('Backup semanal do Google Drive concluído', resultado);
});
