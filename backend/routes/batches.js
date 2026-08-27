const express = require('express');
const router = express.Router();

const upload = require('../middleware/upload');
const ctrl = require('../controllers/batchController');

router.post('/upload', upload.single('zipFile'), ctrl.uploadBatch);
router.get('/', ctrl.listBatches);
router.get('/:id', ctrl.getBatch);
router.get('/:id/submissions', ctrl.getSubmissions);
router.get('/:id/pairs', ctrl.getPairs);
router.get('/:id/groups', ctrl.getGroups);
router.get('/:id/diff/:subA/:subB', ctrl.getDiff);

module.exports = router;
