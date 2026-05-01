const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Convert local image file to base64 data URL
 */
const imageToBase64 = (filePath) => {
  const absolutePath = path.resolve(filePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  return { base64, mimeType };
};

/**
 * Analyze a single image using GPT-4o Vision
 * Returns: roomType, features, improvements, score
 */
const analyzeImage = async (imagePath) => {
  try {
    const { base64, mimeType } = imageToBase64(imagePath);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'low',
              },
            },
            {
              type: 'text',
              text: `Analyze this real estate property image and respond ONLY with valid JSON (no markdown, no explanation):
{
  "roomType": "one of: bedroom | living_room | kitchen | bathroom | dining_room | exterior | garden | pool | balcony | other",
  "features": ["array of features visible, e.g: pool, sea_view, garden, luxury_interior, modern_kitchen, open_plan, natural_light, high_ceiling, fireplace, city_view"],
  "improvements": ["array of 1-3 short improvement suggestions, e.g: improve lighting, increase image clarity, better angle, remove clutter"],
  "score": <integer 0-100 representing image quality and appeal for real estate listing>
}`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content.trim();
    const parsed = JSON.parse(content);
    return {
      roomType: parsed.roomType || 'other',
      features: parsed.features || [],
      improvements: parsed.improvements || [],
      score: parsed.score || 50,
    };
  } catch (error) {
    console.error('❌ OpenAI image analysis failed:', error.message);
    // Fallback so the app doesn't crash
    return {
      roomType: 'other',
      features: [],
      improvements: [],
      score: 50,
    };
  }
};

/**
 * Generate a luxury property description based on all image insights
 */
const generateDescription = async (propertyData, imageInsights) => {
  try {
    const insightsSummary = imageInsights
      .map(
        (img) =>
          `- ${img.roomType}: features include ${img.features.join(', ') || 'none detected'}`
      )
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Write a short, luxury real estate description (3-4 sentences) for this property:

Property: ${propertyData.title}
Location: ${propertyData.location}
Price: $${propertyData.price.toLocaleString()}

Image Analysis:
${insightsSummary}

Style: Premium, aspirational, evocative. Like a high-end real estate listing. No bullet points, just flowing prose.`,
        },
      ],
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI description generation failed:', error.message);
    return `Experience the pinnacle of luxury living at ${propertyData.title}, located in the prestigious ${propertyData.location}. This exceptional property offers an unparalleled lifestyle opportunity.`;
  }
};

/**
 * Extract unique tags from all image features
 */
const extractTags = (imageInsights) => {
  const tagMap = {
    pool: 'pool',
    sea_view: 'sea_view',
    garden: 'garden',
    luxury_interior: 'luxury',
    modern_kitchen: 'modern',
    open_plan: 'open_plan',
    natural_light: 'bright',
    high_ceiling: 'spacious',
    fireplace: 'cozy',
    city_view: 'city_view',
    balcony: 'balcony',
    exterior: 'outdoor',
  };

  const allFeatures = imageInsights.flatMap((img) => img.features);
  const uniqueFeatures = [...new Set(allFeatures)];

  const tags = uniqueFeatures
    .map((f) => tagMap[f] || f.toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);

  return [...new Set(tags)];
};

module.exports = { analyzeImage, generateDescription, extractTags };
