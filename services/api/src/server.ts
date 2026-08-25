import { config } from './config.js';
import { createApp } from './app.js';
import { AppStore } from './store.js';

const store = await AppStore.seeded();
const app = createApp(store);

app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});
