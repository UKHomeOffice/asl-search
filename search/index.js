const { Client } = require('@elastic/elasticsearch');
const minimist = require('minimist');
const { green } = require('chalk');

const config = require('../config');

const client = new Client({ node: config.elastic.node });

const index = config.elastic.index;

const args = minimist(process.argv.slice(2));
const term = args._.join(' ');

if (!term) {
  console.error('Search term must be defined');
  process.exit(1);
}

console.log(`Searching for "${green(term)}"`);

Promise.resolve()
  .then(() => {
    return client.search({
      index,
      _source: [
        'id',
        'title',
        'establishment'
      ],
      size: 50,
      body: {
        query: {
          match: {
            content: {
              query: term
            }
          }
        }
      }
    });
  })
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
