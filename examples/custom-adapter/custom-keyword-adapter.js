'use strict';

const { sha256 } = require('../../src/core/hash');

class CustomKeywordAdapter {
    constructor(keywords = []) {
        this.name = 'custom_keyword_adapter';
        this.capabilities = ['custom_keyword_context'];
        this.keywords = keywords;
    }

    canHandle() {
        return this.keywords.length > 0;
    }

    async discover(input) {
        return this.keywords.map((keyword, index) => {
            const summary = `Custom keyword context: ${keyword}`;
            return {
                id: `custom_keyword_${index + 1}`,
                path: `custom-keywords/${index + 1}`,
                type: 'custom_keyword',
                classification: 'allowed',
                reason: 'provided by explicit custom adapter input',
                hash: sha256(summary),
                summary,
                heading: keyword,
                byte_count: Buffer.byteLength(summary),
                line_count: 1,
                provenance: {
                    adapter: this.name,
                    source_kind: 'custom_keyword',
                    root: input.projectRoot,
                },
            };
        });
    }
}

module.exports = {
    CustomKeywordAdapter,
};
