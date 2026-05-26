const express = require('express');
const router = express.Router();
const wasteItemController = require('../../controllers/api/wasteItemController');

router.get('/', wasteItemController.getWasteItems);
router.post('/', wasteItemController.createWasteItem);
router.put('/:id', wasteItemController.updateWasteItem);
router.put('/', wasteItemController.updateWasteItemsBulk);
router.delete('/:id', wasteItemController.deleteWasteItem);

module.exports = router;
