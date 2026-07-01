import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  mimeType:   String,
  size:       Number,
  fileId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const MaintenanceSchema = new mongoose.Schema({
  blockId:       String,
  blockIds:      [String],
  unitId:        String,
  targetScope:   { type: String, enum: ['unit', 'block'], default: 'unit' },
  commonAreaName:String,
  issueDate:     String,
  unitsCovered:  { type: Number, default: 0 },
  label:         String,
  type:          String,
  description:   String,
  reportedDate:  String,
  scheduledDate: String,
  status:        { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  cost:          { type: Number, default: 0 },
  contractor:    String,
  contractorContact: String,
  location:      String,
  receiptBreakdown: mongoose.Schema.Types.Mixed,
  attachments:   [AttachmentSchema],
}, { timestamps: true });

export default mongoose.model('Maintenance', MaintenanceSchema);
