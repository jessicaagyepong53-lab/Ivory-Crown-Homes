/**
 * One-time fix: Set Samuel's advanceMonths to 12
 * (was incorrectly stored as 3; reflects the full 12-month advance paid)
 *
 * Run: node server/fix-samuel-advance-months.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Block from './models/Block.js';

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected to MongoDB');

let found = false;

const blocks = await Block.find();
for (const block of blocks) {
  let changed = false;
  for (const unit of block.units) {
    for (const tenant of unit.tenants) {
      if (/samuel/i.test(tenant.name) && tenant.leaseStatus === 'active') {
        console.log(`\nFound: "${tenant.name}" in unit "${unit.name}" / block "${block.name}"`);
        console.log(`  advanceMonths before: ${tenant.advanceMonths}`);
        tenant.advanceMonths = 12;
        changed = true;
        found = true;
        console.log(`  advanceMonths after:  ${tenant.advanceMonths}`);
      }
    }
  }
  if (changed) {
    block.markModified('units');
    await block.save();
    console.log('  ✅ advanceMonths updated to 12');
  }
}

if (!found) {
  console.error('\n❌ No active tenant named Samuel found.');
}

await mongoose.disconnect();
console.log('\nDone.');
