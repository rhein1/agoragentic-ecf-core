'use strict';

class ContextAdapter {
    constructor(options = {}) {
        this.name = options.name || 'context-adapter';
        this.capabilities = options.capabilities || [];
    }

    canHandle() {
        return false;
    }

    async discover() {
        throw new Error(`${this.name} must implement discover()`);
    }
}

class AdapterRegistry {
    constructor(adapters = []) {
        this.adapters = [];
        for (const adapter of adapters) this.register(adapter);
    }

    register(adapter) {
        if (!adapter || typeof adapter.discover !== 'function') {
            throw new TypeError('adapter must implement discover(input)');
        }
        this.adapters.push(adapter);
        return this;
    }

    async discoverAll(input) {
        const results = [];
        for (const adapter of this.adapters) {
            if (typeof adapter.canHandle === 'function' && !adapter.canHandle(input)) continue;
            const discovered = await adapter.discover(input);
            if (Array.isArray(discovered)) results.push(...discovered);
        }
        return results.sort((a, b) => a.path.localeCompare(b.path));
    }
}

module.exports = {
    AdapterRegistry,
    ContextAdapter,
};
