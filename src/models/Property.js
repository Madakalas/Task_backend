const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    description: {
      type: String,
      default: null, // AI generated
    },
    tags: {
      type: [String],
      default: [],
    },
    coverImage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Image',
      default: null,
    },
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing',
    },
  },
  { timestamps: true }
);

// Index for search/filter
propertySchema.index({ location: 'text', title: 'text' });
propertySchema.index({ tags: 1 });
propertySchema.index({ price: 1 });

module.exports = mongoose.model('Property', propertySchema);
