import mongoose from 'mongoose';

const { Schema } = mongoose;

const TrashSchema = new Schema({
  type:          { type: String, enum: ['block', 'unit', 'tenant'], required: true },
  label:         { type: String, required: true },   // item's own name
  context:       { type: String, default: '' },      // e.g. "Block A" or "Block A / Room 3"
  data:          { type: Schema.Types.Mixed, required: true }, // full serialised object
  deletedAt:     { type: Date, default: Date.now },
  expiresAt:     { type: Date, required: true },     // deletedAt + 30 days
  parentBlockId: String,   // for units & tenants
  parentUnitId:  String,   // for tenants only
});

export default mongoose.model('Trash', TrashSchema);
