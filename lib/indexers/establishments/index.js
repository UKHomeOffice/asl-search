const { pick } = require('lodash');
const deleteIndex = require('../utils/delete-index');

const indexName = 'establishments';
const columnsToIndex = ['id', 'name', 'licenceNumber', 'status', 'keywords', 'suspendedDate'];

const indexEstablishment = (esClient, establishment) => {
  return esClient.index({
    index: indexName,
    id: establishment.id,
    body: {
      ...pick(establishment, columnsToIndex),
      licenceNumber: establishment.licenceNumber ? establishment.licenceNumber.toUpperCase() : null
    }
  });
};

const reset = esClient => {
  console.log(`Rebuilding index ${indexName}`);
  return Promise.resolve()
    .then(() => deleteIndex(esClient, indexName))
    .then(() => {
      return esClient.indices.create({
        index: indexName,
        body: {
          settings: {
            analysis: {
              analyzer: {
                default: {
                  tokenizer: 'whitespace',
                  filter: ['lowercase', 'stop']
                }
              },
              normalizer: {
                licenceNumber: {
                  type: 'custom',
                  filter: ['lowercase']
                }
              }
            }
          },
          mappings: {
            properties: {
              name: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              licenceNumber: {
                type: 'keyword',
                normalizer: 'licenceNumber'
              },
              status: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              suspendedDate: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
                  }
                }
              }
            }
          }
        }
      });
    });
};

module.exports = (schema, esClient, options = {}) => {
  const { Establishment } = schema;

  if (options.reset && options.id) {
    throw new Error('Do not define an id when resetting indexes');
  }

  return Promise.resolve()
    .then(() => {
      if (options.reset) {
        return reset(esClient);
      }
    })
    .then(() => {
      return Establishment.query()
        .where(builder => {
          if (options.id) {
            builder.where({ id: options.id });
          }
        })
        .select(columnsToIndex)
        .withGraphFetched('[asru]');
    })
    .then(establishments => {
      console.log(`Indexing ${establishments.length} establishments`);
      return establishments.reduce((p, establishment) => {
        return p.then(() => indexEstablishment(esClient, establishment));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
