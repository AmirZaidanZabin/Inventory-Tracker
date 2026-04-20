const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
console.log('Project ID in Service Account IS:', sa.project_id);
console.log('Client Email:', sa.client_email);
