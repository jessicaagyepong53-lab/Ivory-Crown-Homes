import mongoose from 'mongoose';

// Key-value store for app settings (e.g. hashed PIN)
const SettingsSchema = new mongoose.Schema({
  key:   { type: String, unique: true, required: true },
  value: { type: String, required: true },
});

export default mongoose.model('Settings', SettingsSchema);
