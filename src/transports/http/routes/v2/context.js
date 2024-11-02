const express = require('express');
const router = express.Router();
const debug = require('debug')('canvas:transports:rest:context');

router.get('/', async (req, res) => {
    debug('GET /');
    res.json({ status: 'ok' });
});


router.get('/query', async (req, res) => {
    debug('GET /query');
    const ResponseObject = req.ResponseObject;
    const contextId = req.query.contextId;
    const query = req.query;

    const response = new ResponseObject();

    // Validate input
    if (!contextId) { return res.status(400).json({ error: 'Missing contextId' }); }
    if (!query) { return res.status(400).json({ error: 'Missing query' }); }
    debug(`Querying context ${contextId} with query: ${JSON.stringify(query)}`);

    try {
        const context = {} //req.canvas.getContext(contextId);
        const result = {} //await context.query(query);
        res.status(200).json(response.success(result).getResponse());
    } catch (error) {
        res.status(400).json(response.error(error.message).getResponse());
    }
});

module.exports = router;
