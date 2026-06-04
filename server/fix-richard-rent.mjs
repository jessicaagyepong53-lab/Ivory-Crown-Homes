import 'dotenv/config';
import mongoose from 'mongoose';
import Block from './models/Block.js';

await mongoose.connect(process.env.MONGO_URI);

const block = await Block.findOne({ name: 'Block A' });
const unit = block.units.find(u => u.name === 'Room 3');
const tenant = unit.tenants.find(t => /richard/i.test(t.name));

// Monthly rent on the unit
unit.monthlyRent = 2000;

// Tenant financials
tenant.depositPaid   = true;
tenant.depositAmount = 2000;   // security deposit
tenant.notes = 'Advance rent paid in full: GHS 24,000 (12 months × GHS 2,000). Security deposit: GHS 2,000 (paid). No pets. Ghana card required.';

await block.save();
console.log('Done. monthlyRent:', unit.monthlyRent, '| depositAmount:', tenant.depositAmount);
await mongoose.disconnect();
