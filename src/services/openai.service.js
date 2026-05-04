const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Convert local image file to base64
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
 * Safely parse JSON from GPT-4o response
 * Handles cases where GPT wraps output in ```json ... ``` fences
 */
const safeParseJSON = (content) => {
  // Strip markdown code fences if present
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  return JSON.parse(cleaned);
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
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: 'high', // FIX 1: use high detail for accurate room detection
              },
            },
            {
              type: 'text',
              text: `You are a real estate image analyst. Carefully examine this property image.

Respond with ONLY a raw JSON object. No markdown, no code fences, no explanation. Just the JSON.

{
  "roomType": "Pick EXACTLY one: bedroom | living_room | kitchen | bathroom | dining_room | exterior | garden | pool | balcony | home_office | garage | terrace | other",
  "features": ["Pick ALL that apply from: pool, sea_view, garden, city_view, luxury_interior, modern_design, natural_light, high_ceiling, fireplace, open_plan, wooden_floors, marble_floors, large_windows, balcony, terrace, mountain_view, lake_view, jacuzzi, home_theater, wine_cellar, smart_home"],
  "improvements": ["List 1-3 specific improvements for this exact image, e.g: increase brightness, straighten horizon, declutter foreground, use wider angle lens, shoot during golden hour"],
  "score": <integer from 0-100. 90+ = magazine quality. 70-89 = professional. 50-69 = acceptable. Below 50 = poor quality>
}

Be specific. If you see a swimming pool, include "pool". If there is a garden visible, include "garden". Do not return empty features array unless the image is completely blank.`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0].message.content.trim();
    const parsed = safeParseJSON(content); // FIX 2: safe JSON parse strips markdown fences

    return {
      roomType: parsed.roomType || 'exterior',
      features: Array.isArray(parsed.features) ? parsed.features : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      score: typeof parsed.score === 'number' ? parsed.score : 60,
    };
  } catch (error) {
    console.error(`❌ OpenAI image analysis failed for ${imagePath}:`, error.message);
    return {
      roomType: 'exterior',
      features: [],
      improvements: [],
      score: 60,
    };
  }
};

/**
 * Generate a luxury property description based on all image insights
 */
const generateDescription = async (propertyData, imageInsights) => {
  try {
    const roomSummary = imageInsights
      .filter(img => img.roomType && img.roomType !== 'other')
      .map(img => `${img.roomType.replace(/_/g, ' ')}: ${img.features.join(', ') || 'elegant space'}`)
      .join('\n');

    const allFeatures = [...new Set(imageInsights.flatMap(img => img.features))];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 350,
      messages: [
        {
          role: 'user',
          content: `Write a 3-4 sentence luxury real estate listing description for this property.

Property: ${propertyData.title}
Location: ${propertyData.location}
Price: $${propertyData.price.toLocaleString()}

Rooms & Spaces detected:
${roomSummary || 'Luxury property with premium finishes'}

Key features: ${allFeatures.slice(0, 8).join(', ') || 'premium finishes, luxury design'}

Requirements:
- Write in flowing prose, no bullet points
- Use aspirational, premium language
- Be specific about features detected
- Sound like a Sotheby's or Christie's listing
- Do not start with "Nestled" or "Welcome"
- 3-4 sentences only`,
        },
      ],
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI description generation failed:', error.message);
    return `${propertyData.title} represents the pinnacle of luxury living in ${propertyData.location}. This exceptional residence offers an unparalleled lifestyle with premium finishes and sophisticated design throughout. Every detail has been curated to deliver an extraordinary living experience for the most discerning buyer.`;
  }
};

/**
 * Extract unique tags from all image features
 */
const extractTags = (imageInsights) => {
  const tagMap = {
    pool: 'pool',
    sea_view: 'sea_view',
    lake_view: 'sea_view',
    mountain_view: 'sea_view',
    garden: 'garden',
    luxury_interior: 'luxury',
    modern_design: 'modern',
    open_plan: 'open_plan',
    natural_light: 'bright',
    high_ceiling: 'spacious',
    fireplace: 'cozy',
    city_view: 'city_view',
    balcony: 'balcony',
    terrace: 'balcony',
    jacuzzi: 'pool',
    home_theater: 'luxury',
    wine_cellar: 'luxury',
    smart_home: 'modern',
    wooden_floors: 'luxury',
    marble_floors: 'luxury',
    large_windows: 'bright',
  };

  const allFeatures = imageInsights.flatMap((img) => img.features);
  const uniqueFeatures = [...new Set(allFeatures)];

  const tags = uniqueFeatures
    .map((f) => tagMap[f] || f.toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);

  return [...new Set(tags)].slice(0, 8); // max 8 tags
};

module.exports = { analyzeImage, generateDescription, extractTags };
