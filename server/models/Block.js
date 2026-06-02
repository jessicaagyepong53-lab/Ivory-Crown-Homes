import mongoose from 'mongoose';

const { Schema } = mongoose;

const DocumentSchema = new Schema({
  name:         { type: String, required: true },
  mimeType:     String,
  size:         Number,
  category:     { type: String, default: 'Other' },
  note:         String,
  leasePeriod:  String, // e.g. "2025–2026" — auto-set on upload
  cloudinaryId: String,
  url:          String,
  uploadedAt:   { type: Date, default: Date.now },
}, { _id: true });

const LeaseHistorySchema = new Schema({
  leaseStart:    String,
  leaseEnd:      String,
  depositPaid:   Boolean,
  depositAmount: Number,
  renewedAt:     String, // date the renewal was processed
}, { _id: false });

const TenantSchema = new Schema({
  name:              String,
  phone:             String,
  address:           String,
  email:             String,
  leaseStatus:       { type: String, enum: ['active', 'ended', 'cancelled'], default: 'active' },
  leaseStart:        String,
  leaseEnd:          String,
  cancelDate:        String,
  cancelReason:      String,
  moveInDate:        String,
  depositPaid:       { type: Boolean, default: false },
  depositAmount:     { type: Number, default: 0 },
  idType:            String,
  idNumber:          String,
  dob:               String,
  occupation:        String,
  employer:          String,
  emergencyName:     String,
  emergencyPhone:    String,
  emergencyRelation: String,
  vehicles:          String,
  notes:             String,
  leaseHistory:      [LeaseHistorySchema], // archived previous lease periods
  documents:         [DocumentSchema],
}, { _id: true });

const UnitSchema = new Schema({
  name:        String,
  type:        String,
  monthlyRent: { type: Number, default: 0 },
  tenants:     [TenantSchema],
}, { _id: true });

const BlockSchema = new Schema({
  name:    { type: String, required: true },
  address: { type: String, default: '' },
  type:    { type: String, enum: ['block', 'standalone'], default: 'block' },
  units: [UnitSchema],
}, { timestamps: true });

export default mongoose.model('Block', BlockSchema);
