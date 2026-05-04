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

// Helper: wait ms milliseconds
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: analyze with retry on 429
const analyzeWithRetry = async (filePath, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await analyzeImage(filePath);
      return result;
    } catch (err) {
      const is429 = err.message && err.message.includes('429');
      if (is429 && attempt < retries) {
        const waitMs = attempt * 3000; // 3s, 6s, 9s
        console.log(`  ⏳ Rate limited. Waiting ${waitMs / 1000}s before retry ${attempt}/${retries}...`);
        await sleep(waitMs);
      } else {
        throw err;
      }
    }
  }
};

/**
 * Background job: analyze every image individually,
 * pick cover, generate description, update property
 */
const processImagesWithAI = async (property, imageRecords) => {
  const insights = [];

  console.log(`🤖 Starting AI analysis for ${imageRecords.length} images on property: ${property._id}`);

  for (const img of imageRecords) {
    const filePath = path.join('uploads', img.filename);

    try {
      console.log(`  📸 Analyzing image: ${img.filename}`);

      // Wait 2 seconds between each image to avoid hitting TPM limit
      if (insights.length > 0) await sleep(2000);

      const analysis = await analyzeWithRetry(filePath);

      await Image.findByIdAndUpdate(img._id, {
        roomType: analysis.roomType,
        features: analysis.features,
        improvements: analysis.improvements,
        score: analysis.score,
        aiStatus: 'done',
      });

      insights.push({ ...analysis, imageId: img._id });
      console.log(`  ✅ ${img.filename} → ${analysis.roomType} (score: ${analysis.score})`);

    } catch (err) {
      console.error(`  ❌ Failed to analyze ${img.filename}:`, err.message);

      await Image.findByIdAndUpdate(img._id, {
        roomType: 'exterior',
        features: [],
        improvements: [],
        score: 60,
        aiStatus: 'failed',
      });

      insights.push({
        roomType: 'exterior',
        features: [],
        improvements: [],
        score: 60,
        imageId: img._id,
      });
    }
  }

  // Need at least one insight to continue
  if (insights.length === 0) {
    await Property.findByIdAndUpdate(property._id, { status: 'failed' });
    return;
  }

  // Pick best cover image (highest score)
  const bestImage = insights.reduce((best, curr) =>
    curr.score > best.score ? curr : best
  );

  // Mark as cover
  await Image.findByIdAndUpdate(bestImage.imageId, { isCover: true });

  // Wait before description generation to avoid rate limit
  await sleep(3000);
  const description = await generateDescription(property, insights);

  // Extract tags from all features
  const tags = extractTags(insights);

  // Update property to ready
  await Property.findByIdAndUpdate(property._id, {
    description,
    tags,
    coverImage: bestImage.imageId,
    status: 'ready',
  });

  console.log(`✅ AI processing complete for property: ${property._id}`);
  console.log(`   Cover: ${bestImage.imageId} (score: ${bestImage.score})`);
  console.log(`   Tags: ${tags.join(', ')}`);
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
