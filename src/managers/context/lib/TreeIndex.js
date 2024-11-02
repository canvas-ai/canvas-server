import path from 'path';
import Conf from 'conf'; // Temporary

// TODO: Add tree versioning
class TreeIndex extends Conf {

    constructor(filePath) {

        // Temporary leftover
        if (!filePath) {throw new Error('userDataPath is required');}

        // Conf workaround for now
        let dataDir = path.dirname(filePath);
        let configName = path.basename(filePath, '.json');

        super({
            configName: configName,
            cwd: dataDir,
        });
    }

    putSync(key, value) { return this.set(key, value); }

    getSync(key) { return this.get(key); }

    nextVersion() {}

    previousVersion() {}

    listVersions() {}

    diff(vID1, vID2) {}

}

export default TreeIndex;
