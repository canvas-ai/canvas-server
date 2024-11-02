import { memoryUsage } from 'process';

// pidusage | https://www.npmjs.com/package/pidusage
// Test
const { rss, heapTotal, heapUsed, external } = memoryUsage();
console.log(`RSS: ${rss}, Heap Total: ${heapTotal}, Heap Used: ${heapUsed}, External: ${external}`);

export default memoryUsage;
