'use strict';

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
        this.id = options.id ?? null;
        this.schema = options.schema ?? DOCUMENT_SCHEMA;
        this.schemaVersion = options.schemaVersion ?? DOCUMENT_SCHEMA_VERSION;
        this.created_at = options.created_at ?? new Date().toISOString();
        this.updated_at = options.updated_at ?? this.created_at;

        this.index = {
            primaryChecksumAlgorithm: DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO,
            primaryChecksumFields: ['data'],
            fullTextIndexFields: ['data'],
            embeddingFields: ['data'],
            ...options.index,
        };

        this.checksums = new Map(options.checksums ?? [[DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO, null]]);
        this.meta = {
            dataContentType: options.meta?.dataContentType ?? DEFAULT_DOCUMENT_DATA_TYPE,
            dataContentEncoding: options.meta?.dataContentEncoding ?? DEFAULT_DOCUMENT_DATA_ENCODING,
            ...options.meta,
        };
        this.data = options.data ?? {};

        this.storagePaths = options.storagePaths ?? [];
        this.features = new Set(options.features ?? []);

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
     * Storage path helpers
     */

    addStoragePath(path) {
        if (!this.storagePaths.includes(path)) {
            this.storagePaths.push(path);
        }
    }

    addStoragePathArray(pathArray) {
        pathArray.forEach((path) => this.storagePaths(path));
    }

    removeStoragePath(path) {
        this.storagePaths = this.storagePaths.filter((storagePath) => storagePath !== path);
    }

    getStoragePaths() { return this.storagePaths; }

    hasStoragePath(path) { return this.storagePaths.includes(path); }


    /**
     * Checksum helpers
     */

    addChecksum(algorithm = DEFAULT_DOCUMENT_DATA_CHECKSUM_ALGO, value) {
        this.checksums.set(algorithm, value);
    }

    addChecksumArray(checksums) {
        checksums.forEach(([algorithm, value]) => this.checksums.set(algorithm, value));
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
        this.features.add(feature);
    }

    addFeatureArray(features) {
        features.forEach((feature) => this.features.add(feature));
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
            id: this.id,
            schema: this.schema,
            schemaVersion: this.schemaVersion,
            created_at: this.created_at,
            updated_at: this.updated_at,
            index: this.index,
            checksums: Object.fromEntries(this.checksums),
            meta: this.meta,
            data: this.data,
            storagePaths: this.storagePaths,
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
        if (!this.schema) { throw new Error('Document schema is not defined'); }
        if (!this.id) { throw new Error('Document ID is not defined'); }
        if (!Number.isInteger(this.id)) { throw new Error('Document id has to be INT32'); }
        if (!(this.checksums instanceof Map)) { throw new Error('Document checksums must be a Map'); }
        if (!this.checksums.has(this.index.primaryChecksumAlgorithm)) {
            throw new Error(`Document must have a checksum for the primary algorithm: ${this.index.primaryChecksumAlgorithm}`);
        }
        if (!this.meta.dataContentType) { throw new Error('Document must have a dataContentType'); }
        if (!(this.features instanceof Set)) { throw new Error('Document features must be a Set'); }

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
        return document.schema &&
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
            checksums: 'array', // Set
            meta: 'object',
            data: 'object',
            storagePaths: 'array',
            features: 'array',  // Set
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

}

module.exports = Document;
