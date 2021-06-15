const { pick } = require('lodash');
const deleteIndex = require('../utils/delete-index');

const indexName = 'places';
const columnsToIndex = ['id', 'establishmentId', 'suitability', 'holding', 'restrictions'];

const indexPlace = (esClient, place) => {
  if (place.deleted) {
    return esClient.delete({
      index: indexName,
      id: place.id
    }).catch(e => {
      // do nothing if delete fails for record not found
    });
  }
  return esClient.index({
    index: indexName,
    id: place.id,
    body: {
      site: place.site || '',
      area: place.area || '',
      name: place.name || '',
      ...pick(place, columnsToIndex),
      nacwos: place.nacwos.map(r => {
        return {
          ...pick(r.profile, 'id', 'firstName', 'lastName'),
          name: `${r.profile.firstName} ${r.profile.lastName}`
        };
      }),
      nvssqps: place.nvssqps.map(r => {
        return {
          ...pick(r.profile, 'id', 'firstName', 'lastName'),
          name: `${r.profile.firstName} ${r.profile.lastName}`
        };
      })
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
              area: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              site: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              suitability: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              holding: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              'nacwos.name': {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              'nvssqps.name': {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
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
  const { Place } = schema;

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
      return Place.queryWithDeleted()
        .where(builder => {
          if (options.id) {
            builder.where({ 'places.id': options.id });
          }
          if (options.establishmentId) {
            builder.where({ 'places.establishmentId': options.establishmentId });
          }
        })
        .joinRoles();
    })
    .then(places => {
      return places.map(place => {
        return {
          ...place,
          nacwos: place.roles.filter(r => r.type === 'nacwo'),
          nvssqps: place.roles.filter(r => ['nvs', 'sqp'].includes(r.type))
        };
      });
    })
    .then(places => {
      console.log(`Indexing ${places.length} places`);
      return places.reduce((p, place) => {
        return p.then(() => indexPlace(esClient, place));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
