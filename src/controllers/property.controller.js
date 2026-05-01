const Property = require('../models/Property');
const Image = require('../models/Image');

/**
 * POST /api/properties
 * Add a new property
 */
const addProperty = async (req, res) => {
  try {
    const { title, price, location } = req.body;

    if (!title || !price || !location) {
      return res.status(400).json({
        success: false,
        message: 'Title, price, and location are required',
      });
    }

    const property = await Property.create({ title, price, location });

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: property,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: error.message,
    });
  }
};

/**
 * GET /api/properties
 * Fetch all properties with pagination & filters
 * Query: page, limit, location, minPrice, maxPrice, tags
 */
const getProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      location,
      minPrice,
      maxPrice,
      tags,
      search,
    } = req.query;

    const filter = {};

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (tags) {
      const tagArray = tags.split(',').map((t) => t.trim());
      filter.tags = { $in: tagArray };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Property.countDocuments(filter);

    const properties = await Property.find(filter)
      .populate('coverImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: properties,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message,
    });
  }
};

/**
 * GET /api/properties/:id
 * Fetch single property with all images
 */
const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      'coverImage'
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
      });
    }

    const images = await Image.find({ propertyId: req.params.id }).sort({
      score: -1,
    });

    res.status(200).json({
      success: true,
      data: { ...property.toObject(), images },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property',
      error: error.message,
    });
  }
};

module.exports = { addProperty, getProperties, getPropertyById };
