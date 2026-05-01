const express = require('express');
const router = express.Router();
const {
  addProperty,
  getProperties,
  getPropertyById,
} = require('../controllers/property.controller');

router.post('/', addProperty);
router.get('/', getProperties);
router.get('/:id', getPropertyById);

module.exports = router;
