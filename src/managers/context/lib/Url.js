import { urlToHttpOptions } from 'node:url';
import internalLayers from '../../tree/layer/lib/builtinLayers.js';

const DEFAULT_URL_PROTOCOL = 'universe:';
const DEFAULT_URL_PATH = '/';

export default class Url {
    constructor(url, baseUrl = null, protocol = DEFAULT_URL_PROTOCOL) {
        this._baseUrl = baseUrl;
        this._protocol = protocol;
        this.setUrl(url);
    }

    validate(url) { return Url.validate(url); }

    static validate(url) {
        if (typeof url !== 'string') {
            throw new Error(`Context path needs to be of type string, got "${typeof url}"`);
        }

        if (/[`$%^*;'",<>{}[\]\\]/gi.test(url)) {
            throw new Error(`Context path cannot contain special characters, got "${url}"`);
        }

        return true;
    }

    setUrl(url = DEFAULT_URL_PATH) {
        if (typeof url !== 'string') {throw new Error('Context path needs to be of type string');}

        this._path = this.getPath(url);
        this._protocol = this.getProtocol(url);
        this._string = this._protocol + '//' + this._path;
        this._array = this.getArrayFromString(this._string);

        return this._path;
    }

    get url() { return this._string; }
    get string() { return this._string; }
    get path() { return this._path; }
    get array() { return this._array; }
    get protocol() { return this._protocol; }

    static parse(url) {
        let path = Url.getPath(url);
        let protocol = Url.getProtocol(url);
        return protocol + '/' + path;
    }

    getProtocol(url) { return Url.getProtocol(url); }

    static getProtocol(url) {
        if (!url.includes(':')) {return DEFAULT_URL_PROTOCOL;}
        let proto = url.split(':');
        return (proto && proto.length > 0) ? proto[0] + ':' : DEFAULT_URL_PROTOCOL;
    }

    getPath(url) { return Url.getPath(url);  }

    static getPath(url) {
        let sanitized = url.toLowerCase();

        if (!sanitized.startsWith(DEFAULT_URL_PROTOCOL) && !sanitized.startsWith('/') && this._baseUrl) {
            sanitized = this._baseUrl + '/' + sanitized;
        }

        sanitized = sanitized
            .replace(/\\/g, '/')
            .replace(/^[^:]+:/, '')
            .replace(/\/+/g, '/')
            .replace(/ +/g, '_')
            .replace(/[`$%^*;'",<>{}[\]\\]/gi, '');

        sanitized = sanitized.split('/')
            .map(part => {
                if (part.startsWith('.')) {
                    return internalLayers.some(layer => layer.name === part) ? part : part.substring(1);
                }
                return part.trim();
            })
            .filter(part => part.length > 0)
            .join('/');

        if (!sanitized.startsWith('/')) {sanitized = '/' + sanitized;}
        return sanitized || DEFAULT_URL_PATH;
    }

    getArrayFromString(url) { return Url.getArrayFromString(url); }

    static getArrayFromString(url) {
        let parsed = urlToHttpOptions(new URL(url));
        if (!parsed) {throw new Error(`Invalid URL: ${url}`);}

        let context = [
            parsed.hostname,
            ...parsed.pathname.split('/'),
        ];

        return context.filter(v => v.length > 0);
    }
}
