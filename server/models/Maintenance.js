import mongoose from 'mongoose';

const MaintenanceSchema = new mongoose.Schema({
  blockId:       { type: mongoose.Schema.Types.ObjectId },
  unitId:        { type: mongoose.Schema.Types.ObjectId },
  label:         String,
  type:          String,
  description:   String,
  reportedDate:  String,
  scheduledDate: String,
  status:        { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  cost:          { type: Number, default: 0 },
  contractor:    String,
}, { timestamps: true });

export default mongoose.model('Maintenance', MaintenanceSchema);
