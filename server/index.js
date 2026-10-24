import { env, IS_PROD } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

if (IS_PROD && !env.adminPassword) {
  console.warn('[alio] ADMIN_PASSWORD is not set: the admin dashboard is disabled until you set it.');
}
if (!IS_PROD && env.adminPassword === 'admin1234') {
  console.warn('[alio] Using the development admin password "admin1234". Set ADMIN_PASSWORD before going live.');
}

openDb();
const app = createApp();
app.listen(env.port, () => {
  console.log(`[alio] 멍냥이 server listening on http://localhost:${env.port}`);
  console.log(`[alio] AI photo verification: ${env.anthropicApiKey ? 'on' : 'off (self-report mode)'}`);
});
