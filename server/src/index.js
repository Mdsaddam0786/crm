import app from './app.js';
import { config } from './config.js';
import { storageKind } from './data/store.js';

app.listen(config.port, () => {
  console.log(`JV CRM listening on http://localhost:${config.port} (storage: ${storageKind() === 'file' ? `${config.dataDir}${process.platform === 'win32' ? '\\' : '/'}listings.json` : storageKind()})`);
});
