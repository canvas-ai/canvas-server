'use strict';

const path = require('path');
const {
    format,
    parseISO,
    isToday,
    isYesterday,
    isThisWeek,
    isThisISOWeek,
    isThisMonth,
    isThisQuarter,
    isThisYear,
} = require('date-fns');

const DOCUMENT_SCHEMA = 'data/abstraction/document';
const DOCUMENT_SCHEMA_VERSION = '2.0';
const DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO = 'sha1';
const DEFAULT_DOCUMENT_DATA_FORMAT = 'application/json';
const DEFAULT_DOCUMENT_DATA_ENCODING = 'utf8';

class Document {
    constructor(options = {}) {
        this.id = options.id ?? null;
        this.schema = options.schema ?? DOCUMENT_SCHEMA;
        this.schemaVersion = options.schemaVersion ?? DOCUMENT_SCHEMA_VERSION;
        this.created_at = options.created_at ?? new Date().toISOString();
        this.updated_at = options.updated_at ?? this.created_at;

        this.index = {
            primaryChecksumAlgorithm: DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO,
            primaryChecksumFields: ['data'],
            staticFeatureBitmapFields: [],
            dynamicFeatureBitmapFields: [],
            fullTextIndexFields: [],
            embeddingFields: ['data'],
            ...options.index,
        };

        this.checksums = new Map(options.checksums ?? [[DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO, null]]);
        this.meta = {
            dataContentType: options.meta?.dataContentType ?? DEFAULT_DOCUMENT_DATA_FORMAT,
            dataContentEncoding: options.meta?.dataContentEncoding ?? DEFAULT_DOCUMENT_DATA_ENCODING,
            ...options.meta,
        };

        this.data = options.data ?? [];
        this.features = new Set(options.features ?? []);

        this.parent_id = options.parent_id ?? null;
        this.versions = options.versions ?? [];
        this.version_number = options.version_number ?? 1;
        this.latest_version = options.latest_version ?? 1;
    }

    addFeature(feature) {
        this.features.add(feature);
    }

    removeFeature(feature) {
        this.features.delete(feature);
    }

    hasFeature(feature) {
        return this.features.has(feature);
    }

    getAllFeatures() {
        return Array.from(this.features);
    }

    updateFields(data) {
        Object.assign(this, data);
        this.updated_at = new Date().toISOString();
    }

    static isWithinTimeframe(dateString, timeframe) {
        const date = parseISO(dateString);
        const timeframeChecks = {
            today: isToday,
            yesterday: isYesterday,
            thisWeek: isThisWeek,
            thisISOWeek: isThisISOWeek,
            thisMonth: isThisMonth,
            thisQuarter: isThisQuarter,
            thisYear: isThisYear,
        };

        return timeframeChecks[timeframe]?.(date) ?? false;
    }

    toJSON() {
        return {
            id: this.id,
            schema: this.schema,
            schemaVersion: this.schemaVersion,
            created_at: this.created_at,
            updated_at: this.updated_at,
            index: this.index,
            checksums: Object.fromEntries(this.checksums),
            meta: this.meta,
            data: this.data,
            features: Array.from(this.features),
            parent_id: this.parent_id,
            versions: this.versions,
            version_number: this.version_number,
            latest_version: this.latest_version,
        };
    }

    static fromJSON(json) {
        const doc = new Document({
            ...json,
            checksums: new Map(Object.entries(json.checksums)),
            features: new Set(json.features),
        });
        return doc;
    }

    validate() {
        if (!this.schema) throw new Error('Document schema is not defined');
        if (!Array.isArray(this.data)) throw new Error('Document data must be an array');
        if (this.data.length === 0) throw new Error('Document must have at least one data URL');
        if (!(this.checksums instanceof Map)) throw new Error('Document checksums must be a Map');
        if (!this.checksums.has(this.index.primaryChecksumAlgorithm)) {
            throw new Error(`Document must have a checksum for the primary algorithm: ${this.index.primaryChecksumAlgorithm}`);
        }
        if (!this.meta.dataContentType) throw new Error('Document must have a dataContentType');
        if (!(this.features instanceof Set)) throw new Error('Document features must be a Set');
        return true;
    }

    static validate(document) {
        if (!document) throw new Error('Document is not defined');
        return document.schema &&
               Array.isArray(document.data) &&
               document.data.length > 0 &&
               document.checksums instanceof Map &&
               document.checksums.has(document.index.primaryChecksumAlgorithm) &&
               document.meta.dataContentType &&
               document.features instanceof Set;
    }

    get schemaDefinition() {
        return this.toJSON();
    }

    static get schemaDefinition() {
        return {
            id: 'string',
            schema: 'string',
            schemaVersion: 'string',
            created_at: 'string',
            updated_at: 'string',
            index: 'object',
            checksums: 'array',
            meta: 'object',
            data: 'array',

            parent_id: 'string',
            versions: 'array',
            version_number: 'number',
            latest_version: 'number',
        };
    }

    isJsonDocument() {
        return this.meta.dataContentType === 'application/json';
    }

    // TODO: Fixme, this assumes everything other than a blob is stored as JSON
    // which may not be the case
    isBlob() {
        return this.meta.dataContentType !== 'application/json';
    }

    update(document) {
        this.id = document.id;
        this.checksums = new Map(Object.entries(document.checksums));
        this.data = document.data;
        if (document.meta?.dataContentType) {
            this.meta.dataContentType = document.meta.dataContentType;
        }
        // TODO: Fixme, this assumes that the features are always an array
        if (document.features) {
            this.features = new Set(document.features);
        }
        this.updated_at = new Date().toISOString();
    }

    addDataUrl(url) {
        if (!this.data.includes(url)) {
            this.data.push(url);
        }
    }

    addChecksum(algorithm, value) {
        this.checksums.set(algorithm, value);
    }

    getChecksum(algorithm) {
        return this.checksums.get(algorithm);
    }

}

// Export the Document class
module.exports = Document;

// Export schema loader function
module.exports.loadSchema = (schemaName) => {
    const schemaPath = path.join(__dirname, 'schemas', `${schemaName}.js`);
    return require(schemaPath);
};
