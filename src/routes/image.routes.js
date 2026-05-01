const express = require('express');
const router = express.Router({ mergeParams: true });
const upload = require('../middleware/upload');
const {
  uploadImages,
  getPropertyImages,
} = require('../controllers/image.controller');

router.post('/', upload.array('images', 5), uploadImages);
router.get('/', getPropertyImages);

module.exports = router;
