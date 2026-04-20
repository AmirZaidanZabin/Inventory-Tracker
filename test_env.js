import fs from 'fs';
const envKeys = Object.keys(process.env);
console.log('ENV HAS SERVICE ACCOUNT?', envKeys.includes('FIREBASE_SERVICE_ACCOUNT'));
