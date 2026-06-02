import dotenv from './server/node_modules/dotenv/lib/main.js';
dotenv.config({ path: './.env' });
import mongoose from './server/node_modules/mongoose/index.js';
import Block from './server/models/Block.js';

await mongoose.connect(process.env.MONGO_URI);
const blocks = await Block.find({});
for (const b of blocks) {
  for (const u of b.units) {
    for (const t of u.tenants) {
      for (const d of t.documents) {
        console.log(JSON.stringify({ did: d._id, name: d.name, cloudinaryId: d.cloudinaryId, url: d.url, mimeType: d.mimeType }));
      }
    }
  }
}
await mongoose.disconnect();
