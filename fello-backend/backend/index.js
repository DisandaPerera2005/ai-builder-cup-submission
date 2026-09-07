require('dotenv').config();
const express = require('express');
const whatsappRoutes = require('./src/whatsapp-routes');
const driveSyncRoutes = require('./src/drive-sync-routes');
const messageWebhook = require('./src/message-webhook');
const agentWhatsappRoutes = require('./src/agent-whatsapp-routes');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Order matters: /internal and /agent must be matched first, otherwise
// whatsappRoutes' auth middleware (mounted at '/') would run for every
// request path and reject it for lacking a Firebase ID token.
// Gateway-facing only: requires GATEWAY_WEBHOOK_SECRET, never called by the browser.
app.use('/internal', messageWebhook);
// Agent-facing only: requires AGENT_BACKEND_SECRET, never called by the browser
// or the gateway — see agent-whatsapp-routes.js for why this exists.
app.use('/agent', agentWhatsappRoutes);

// Frontend-facing: requires a verified Firebase ID token per request.
app.use('/', whatsappRoutes);
app.use('/', driveSyncRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Fello backend listening on :${PORT}`);
});
