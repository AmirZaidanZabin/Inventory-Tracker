const admin = require('firebase-admin');
const config = require('./firebase-applet-config.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json')),
  databaseURL: config.databaseURL
});

async function run() {
  const table = 'leads';
  const val = (await admin.database().ref(table).once('value')).val() || {};
  for(let key of Object.keys(val)) {
     console.log('LEAD', key, val[key]);
  }
  
  const approvalsVal = (await admin.database().ref('approvals').once('value')).val() || {};
  for(let key of Object.keys(approvalsVal)) {
     console.log('APPROVAL', key, approvalsVal[key]);
  }
  process.exit(0);
}
run();
