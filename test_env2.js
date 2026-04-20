try {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log("Parsed OK. Project IS:", sa.project_id);
} catch(e) {
  console.error("Failed to parse", e.message);
}
