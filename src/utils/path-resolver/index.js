import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./src/utils/path-resolver/resolver.js', pathToFileURL('./'));
