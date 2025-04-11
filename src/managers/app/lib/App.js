import logger, { createDebug } from '../../../utils/log/index.js';
const debug = createDebug('app');
import EventEmitter from 'eventemitter2';

class App extends EventEmitter {
    constructor(options) {
        super(options);
        this.options = options;
    }
}

export default App;
