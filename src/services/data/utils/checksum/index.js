'use strict';

const fs = require('fs');
const crypto = require('crypto');

// TODO: We should use a external lib/bin to calculate checksums

function calculateObjectChecksum(obj, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(JSON.stringify(obj));
    return hash.digest('hex');
}

function calculateBinaryChecksum(data, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return hash.digest('hex');
}

async function calculateFileChecksum(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

module.exports = {
    calculateObjectChecksum,
    calculateBinaryChecksum,
    calculateFileChecksum
}
