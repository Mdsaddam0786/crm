import app from './app.js';
import { config } from './config.js';
import { getWorkbook } from './data/store.js';

app.listen(config.port, () => {
  console.log(`JV CRM listening on http://localhost:${config.port}`);
  getWorkbook().catch(() => { /* logged by store; UI shows the error */ });
});
