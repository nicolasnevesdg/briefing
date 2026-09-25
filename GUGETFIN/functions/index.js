const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { criarManipuladorApi } = require('./src/api');

initializeApp();

const alexaOAuthClientSecret = defineSecret('ALEXA_OAUTH_CLIENT_SECRET');

setGlobalOptions({
    region: 'southamerica-east1',
    memory: '256MiB',
    timeoutSeconds: 30,
    maxInstances: 10,
    concurrency: 40
});

const manipulador = criarManipuladorApi({
    db: getFirestore(),
    auth: getAuth(),
    logger,
    getAlexaClientSecret: () => alexaOAuthClientSecret.value()
});

exports.api = onRequest({
    cors: false,
    secrets: [alexaOAuthClientSecret]
}, manipulador);
