const { Client } = require('@elastic/elasticsearch');
const config = require('../config');
const client = new Client({ node: config.elastic.node });

module.exports = term => {
  const params = {
    index: config.elastic.index,
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
  };

  return Promise.resolve()
    .then(() => client.search(params));
};
