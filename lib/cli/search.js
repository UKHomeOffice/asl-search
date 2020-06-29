const minimist = require('minimist');
const { green } = require('chalk');
const search = require('../lib/search');

const args = minimist(process.argv.slice(2));
const term = args._.join(' ');

if (!term) {
  console.error('Search term must be defined');
  process.exit(1);
}

console.log(`Searching for "${green(term)}"`);

Promise.resolve()
  .then(() => search(term))
  .then(result => {
    const count = result.body.hits.total.value;
    console.log(`Found ${green(count)} result${count === 1 ? '' : 's'}:`);
    result.body.hits.hits.forEach(h => console.log(h._source.title));
    process.exit();
  })
  .catch(e => {
    console.error(e.meta.body.error);
    process.exit(1);
  });
