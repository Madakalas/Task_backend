const path = require('path');
const Image = require('../models/Image');
const Property = require('../models/Property');
const {
  analyzeImage,
  generateDescription,
  extractTags,
} = require('../services/openai.service');

/**
 * POST /api/properties/:id/images
 * Upload 1-5 images, trigger async AI analysis
 */
const uploadImages = async (req, res) => {
  try {
    const { id: propertyId } = req.params;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required',
      });
    }

    // Save image records immediately (pending AI)
    const imageRecords = await Image.insertMany(
      req.files.map((file) => ({
        propertyId,
        url: `/uploads/${file.filename}`,
        filename: file.filename,
        aiStatus: 'pending',
      }))
    );

    // Respond immediately, run AI in background
    res.status(202).json({
      success: true,
      message: 'Images uploaded. AI analysis running in background.',
      data: imageRecords,
    });

    // --- Async AI Processing (non-blocking) ---
    processImagesWithAI(property, imageRecords).catch((err) => {
      console.error('❌ Background AI processing failed:', err.message);
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Image upload failed',
      error: error.message,
    });
  }
};

/**
 * Background job: analyze images, pick cover, generate description, update property
 */
const processImagesWithAI = async (property, imageRecords) => {
  const insights = [];

  // Analyze each image
  for (const img of imageRecords) {
    const filePath = path.join('uploads', img.filename);
    const analysis = await analyzeImage(filePath);

    await Image.findByIdAndUpdate(img._id, {
      roomType: analysis.roomType,
      features: analysis.features,
      improvements: analysis.improvements,
      score: analysis.score,
      aiStatus: 'done',
    });

    insights.push({ ...analysis, imageId: img._id });
  }

  // Pick best cover image (highest score)
  const bestImage = insights.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  // Mark as cover
  await Image.findByIdAndUpdate(bestImage.imageId, { isCover: true });

  // Generate description
  const description = await generateDescription(property, insights);

  // Extract tags
  const tags = extractTags(insights);

  // Update property
  await Property.findByIdAndUpdate(property._id, {
    description,
    tags,
    coverImage: bestImage.imageId,
    status: 'ready',
  });

  console.log(`✅ AI processing complete for property: ${property._id}`);
};

/**
 * GET /api/properties/:id/images
 * Get all images for a property
 */
const getPropertyImages = async (req, res) => {
  try {
    const images = await Image.find({ propertyId: req.params.id }).sort({
      score: -1,
    });

    res.status(200).json({
      success: true,
      data: images,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch images',
      error: error.message,
    });
  }
};

module.exports = { uploadImages, getPropertyImages };
