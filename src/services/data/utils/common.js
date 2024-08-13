const fs = require('fs');

function isFile(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}

function isBinary(data) {
    return Buffer.isBuffer(data) || data instanceof ArrayBuffer;
}


module.exports = {
    isFile,
    isBinary,
};
