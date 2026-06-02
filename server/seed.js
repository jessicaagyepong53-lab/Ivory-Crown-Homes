/**
 * One-time seed script — run with: node server/seed.js
 * Initialises the PIN and inserts the first tenant (Comfort Frimpong).
 * Safe to re-run: uses upserts, won't create duplicates.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Settings from './models/Settings.js';
import Block from './models/Block.js';
import { connectDB } from './config/db.js';

async function seed() {
  await connectDB(process.env.MONGO_URI);

  // ── PIN ───────────────────────────────────────────────────────────────────
  const defaultPin = '1234';
  const existing   = await Settings.findOne({ key: 'pin' });
  if (!existing) {
    const hashed = await bcrypt.hash(defaultPin, 12);
    await Settings.create({ key: 'pin', value: hashed });
    console.log('✅ Default PIN "1234" seeded');
  } else {
    console.log('ℹ️  PIN already exists — skipping');
  }

  // ── Block / Tenant ────────────────────────────────────────────────────────
  const existingBlock = await Block.findOne({ name: 'Buulaso Community 25' });
  if (!existingBlock) {
    await Block.create({
      name: 'Buulaso Community 25',
      type: 'block',
      units: [
        {
          name: 'Room 1',
          type: '2-Bedroom',
          monthlyRent: 2500,
          tenants: [
            {
              name:              'Comfort Frimpong',
              phone:             '0554064780',
              email:             '',
              leaseStatus:       'active',
              leaseStart:        '2026-03-01',
              leaseEnd:          '2027-03-01',
              moveInDate:        '2026-03-01',
              cancelReason:      '',
              cancelDate:        '',
              depositPaid:       true,
              depositAmount:     2500,
              idType:            'Ghana Card',
              idNumber:          'GHA-715793333-3',
              dob:               '2003-12-27',
              occupation:        '',
              employer:          '',
              emergencyName:     'Park Inkyu',
              emergencyPhone:    '0547676907',
              emergencyRelation: 'Co-occupant',
              vehicles:          '',
              notes:             '12-month rent paid in full (01/03/2026 – 01/03/2027). Security deposit GHS 2,500 paid. Co-occupant: Park Inkyu (KOR-731155260-4, Korean national). Property: Flat 2, Buulaso Community 25, Accra. Unfurnished 2-bed flat with central water heater, reservoir tank, 2 bathrooms, balcony, CCTV and gate remote.',
              documents:         [],
            },
          ],
        },
      ],
    });
    console.log('✅ Buulaso Community 25 / Comfort Frimpong seeded');
  } else {
    console.log('ℹ️  Block already exists — skipping');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
