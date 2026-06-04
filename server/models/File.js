import mongoose from 'mongoose';

// Stores raw file bytes in MongoDB — no external service needed, no auth issues.
const FileSchema = new mongoose.Schema({
  data:     { type: Buffer, required: true },
  mimeType: { type: String, required: true },
  name:     { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('DocFile', FileSchema);
