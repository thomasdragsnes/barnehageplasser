// models/notificationPreference.js
const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: ['specificKindergarten', 'region', 'distance', 'ageGroup']
  },
  parameters: {
    kindergartenIds: [String],
    region: String,
    location: {
      type: [Number],
      validate: {
        validator: function(v) {
          // Only validate if location is provided
          if (!v || v.length === 0) return true;
          return v.length === 2;
        },
        message: 'Location must be [latitude, longitude]'
      },
      required: false
    },
    maxDistance: Number,
    transportType: {
      type: String,
      enum: ['walking', 'bicycling', 'driving', 'transit']
    },
    ageGroup: String
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);