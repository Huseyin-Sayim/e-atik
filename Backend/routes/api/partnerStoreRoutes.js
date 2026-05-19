const express = require('express');
const { getPartnerStores, addPartnerStore, deletePartnerStore } = require('../../controllers/api/partnerStoreController');

const router = express.Router();

router.get('/', getPartnerStores);
router.post('/create', addPartnerStore);
router.delete('/:id', deletePartnerStore);

module.exports = router;
