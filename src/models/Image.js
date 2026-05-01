const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    roomType: {
      type: String,
      default: null, // e.g. bedroom, kitchen, exterior
    },
    features: {
      type: [String],
      default: [], // e.g. pool, garden, sea view
    },
    improvements: {
      type: [String],
      default: [], // e.g. improve lighting, increase clarity
    },
    score: {
      type: Number,
      default: 0, // AI quality score 0-100
    },
    isCover: {
      type: Boolean,
      default: false,
    },
    aiStatus: {
      type: String,
      enum: ['pending', 'done', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Image', imageSchema);
