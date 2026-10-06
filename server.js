// Local / self-hosted entry point. The Express app itself lives in app.js (Vercel runs it via api/index.js).
const app = require('./app');

const PORT = process.env.PORT || 3001;
// The proxy holds music-server credentials, so dev only listens on loopback unless HOST says otherwise
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT} (${process.env.NODE_ENV || 'development'}, provider: ${app.musicProvider})`);
});
