'use strict';

const e = require('cors');
const {
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
const DEFAULT_DOCUMENT_DATA_TYPE = 'application/json';
const DEFAULT_DOCUMENT_DATA_ENCODING = 'utf8';

class Document {

    constructor(options = {}) {
        // Base
        this.id = options.id ?? null;
        this.schema = options.schema ?? DOCUMENT_SCHEMA;
        this.schemaVersion = options.schemaVersion ?? DOCUMENT_SCHEMA_VERSION;

        // Timestamps
        this.created_at = options.created_at ?? new Date().toISOString();
        this.updated_at = options.updated_at ?? this.created_at;

        // Internal index configuration
        this.index = {
            checksumAlhorithms: [
                DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO,
                'sha256'
            ],
            primaryChecksumAlgorithm: DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO,
            checksumFields: ['data'],
            searchFields: ['data.title', 'data.content'],
            embeddingFields: ['data.title', 'data.content'],
            ...options.index,
        };

        /**
         * Metadata section
         */

        this.metadata = {
            dataContentType: options.meta?.dataContentType ?? DEFAULT_DOCUMENT_DATA_TYPE,
            dataContentEncoding: options.meta?.dataContentEncoding ?? DEFAULT_DOCUMENT_DATA_ENCODING,
            ...options.meta,
        };

        this.checksums = options.checksums ?? new Map(); // Checksums for the document data
        this.embeddings = options.embeddings ?? []; // Extracted embeddings
        this.features = options.features ?? new Map(); // Extracted features
        this.paths = options.paths ?? []; // Storage path reference URLs

        /**
         * Document data/payload, omitted for blobs
         */

        this.data = options.data ?? {};

        /**
         * Versioning
         */
        this.parent_id = options.parent_id ?? null; // Stored in the child document
        this.versions = options.versions ?? []; // Stored in the parent document
        this.version_number = options.version_number ?? 1;
        this.latest_version = options.latest_version ?? 1; // Stored in the parent document
    }

    update(document) {
        Object.assign(this, document);
        this.updated_at = new Date().toISOString();
    }

    /**
     * Checksum helpers
     */

    getChecksumAlgorithms() {
        return this.index.checksumAlgorithms;
    }

    getChecksumFields() {
        let data = {};
        this.index.checksumFields.forEach((field) => {
            data[field] = this.data[field];
        });
        return data;
    }

    addChecksum(algorithm = DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO, value) {
        this.checksums.set(algorithm, value);
    }

    getChecksum(algorithm = DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO) {
        return this.checksums.get(algorithm);
    }

    removeChecksum(algorithm) {
        this.checksums.delete(algorithm);
    }

    hasChecksum(algorithm) {
        return this.checksums.has(algorithm);
    }

    getChecksums() {
        return Array.from(this.checksums);
    }

    clearChecksums() {
        this.checksums.clear();
    }

    /**
     * Feature helpers
     */

    addFeature(feature) {
        this.features.set(feature);
    }

    addFeatureArray(features) {
        features.forEach((feature) => this.features.set(feature));
    }

    removeFeature(feature) {
        this.features.delete(feature);
    }

    hasFeature(feature) {
        return this.features.has(feature);
    }

    getFeatures() {
        return Array.from(this.features);
    }

    clearFeatures() {
        this.features.clear();
    }


    /**
     * Versioning helpers
    */

    addVersion(version) {
        this.versions.push(version);
    }

    removeVersion(version) {
        this.versions = this.versions.filter((v) => v !== version);
    }

    /**
     * Utils
     */

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
            // Base
            id: this.id,
            schema: this.schema,
            schemaVersion: this.schemaVersion,

            // Timestamps
            created_at: this.created_at,
            updated_at: this.updated_at,

            // Internal index configuration
            index: this.index,

            // Metadata section
            metadata: this.metadata,
            checksums: Array.from(this.checksums),
            embeddings: this.embeddings,
            features: Array.from(this.features),
            paths: this.paths,

            // Document data/payload, omitted for blobs
            data: this.data,

            // Versioning
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
            features: new Map(Object.entries(json.features)),
        });
        return doc;
    }

    validate() {
        if (!this.id) { throw new Error('Document ID is not defined'); }
        if (!Number.isInteger(this.id)) { throw new Error('Document id has to be INT32'); }
        if (!this.schema) { throw new Error('Document schema is not defined'); }
        if (!this.schemaVersion) { throw new Error('Document schema version is not defined'); }

        if (!this.metadata) { throw new Error('Document metadata is not defined'); }
        if (!this.metadata.dataContentType) { throw new Error('Document must have a dataContentType'); }
        if (!this.metadata.dataContentEncoding) { throw new Error('Document must have a dataContentEncoding'); }

        if (!(this.checksums instanceof Map)) { throw new Error('Document checksums must be a Map'); }
        if (!this.checksums.has(this.index.primaryChecksumAlgorithm)) {
            throw new Error(`Document must have a checksum for the primary algorithm: ${this.index.primaryChecksumAlgorithm}`);
        }

        if (!this.embeddings) { throw new Error('Document embeddings is not defined'); }
        if (!this.features) { throw new Error('Document features is not defined'); }
        if (!this.paths) { throw new Error('Document paths is not defined'); }

        if (!this.data) { throw new Error('Document data is not defined'); }
        return true;
    }

    validateData() {
        if (this.isJsonDocument()) {
            return this.data && typeof this.data === 'object' && Object.keys(this.data).length > 0;
        }
        return this.isBlob();
    }

    static validate(document) {
        if (!document) throw new Error('Document is not defined');
        return  document.id &&
                Number.isInteger(document.id) &&
                document.schema &&
                document.schemaVersion &&
                document.created_at &&
                document.updated_at &&
                document.index &&
                document.metadata &&
                document.metadata.dataContentType &&
                document.metadata.dataContentEncoding &&
                document.checksums instanceof Map &&
                document.checksums.has(document.index.primaryChecksumAlgorithm) &&
                document.embeddings &&
                document.features instanceof Map &&
                document.paths &&
                document.data;
    }

    get schemaDefinition() {
        return this.toJSON();
    }

    // We should use a proper schema library for this
    static get schemaDefinition() {
        return {
            id: 'number',
            schema: 'string',
            schemaVersion: 'string',

            created_at: 'string',
            updated_at: 'string',

            index: 'object',

            metadata: 'object',
            checksums: 'map',
            embeddings: 'array',
            features: 'map',
            paths: 'array',

            data: 'object',

            parent_id: 'number',
            versions: 'array',
            version_number: 'number',
            latest_version: 'number',
        };
    }

    isJsonDocument() {
        return this.metadata.dataContentType === 'application/json';
    }

    // TODO: Fixme, this assumes everything other than a blob is stored as JSON
    // which may not be the case
    isBlob() {
        return this.metadata.dataContentType !== 'application/json';
    }

}

module.exports = Document;
