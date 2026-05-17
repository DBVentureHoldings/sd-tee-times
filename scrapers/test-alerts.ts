import { checkAndSendAlerts } from "./_shared/alerts.js";

const result = await checkAndSendAlerts();
console.log("Result:", JSON.stringify(result));
