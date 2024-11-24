// TODO: Add tree versioning
// TODO: Streamline this mess-of-a-interface
class TreeIndex {

    constructor(index) {
        if (!index) { throw new Error('index reference is required'); }
        this.index = index;
    }

    put(key, value) { return this.index.set(key, value); }

    putSync(key, value) { return this.index.set(key, value); }

    set(key, value) { return this.index.set(key, value); }

    get(key) { return this.index.get(key); }

    getSync(key) { return this.index.get(key); }

    nextVersion() {}

    previousVersion() {}

    listVersions() {}

    diff(vID1, vID2) {}

}

export default TreeIndex;
