const express = require('express');
const router = express.Router();
const debug = require('debug')('canvas:transports:rest:context');

router.get('/', async (req, res) => {
    debug('GET /');
    res.json({ status: 'ok' });
});


router.get('/query', async (req, res) => {
    debug('GET /query');
});

module.exports = router;
