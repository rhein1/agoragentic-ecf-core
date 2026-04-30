'use strict';

const crypto = require('node:crypto');

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function sourceId(relativePath) {
    return `src_${sha256(relativePath).slice(0, 12)}`;
}

module.exports = {
    sha256,
    sourceId,
};
