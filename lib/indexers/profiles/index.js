const { pick, get } = require('lodash');
const synonyms = require('./synonyms');

const indexName = 'profiles';
const columnsToIndex = [
  'id',
  'title',
  'firstName',
  'lastName',
  'email',
  'telephone',
  'telephoneAlt',
  'postcode',
  'pilLicenceNumber'
];

const indexProfile = (esClient, profile) => {
  return esClient.index({
    index: indexName,
    id: profile.id,
    body: {
      ...pick(profile, columnsToIndex),
      name: `${profile.firstName} ${profile.lastName}`,
      establishments: profile.establishments.map(e => pick(e, 'id', 'name')),
      pilLicenceNumber: profile.pilLicenceNumber ? profile.pilLicenceNumber.toUpperCase() : null
    }
  });
};

const reset = esClient => {
  console.log(`Rebuilding index ${indexName}`);
  return Promise.resolve()
    .then(() => esClient.indices.delete({ index: indexName }))
    .catch(e => {
      if (get(e, 'body.error.type') === 'index_not_found_exception') {
        return;
      }
      throw e;
    })
    .then(() => {
      return esClient.indices.create({
        index: indexName,
        body: {
          settings: {
            'index.max_result_window': 30000,
            analysis: {
              analyzer: {
                default: {
                  tokenizer: 'whitespace',
                  filter: ['lowercase']
                },
                name: {
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding']
                },
                firstname: {
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding', 'synonyms']
                }
              },
              filter: {
                synonyms: {
                  type: 'synonym',
                  synonyms
                }
              },
              normalizer: {
                licenceNumber: {
                  type: 'custom',
                  filter: ['lowercase']
                },
                caseInsensitiveSorting: {
                  type: 'custom',
                  filter: ['lowercase']
                }
              }
            }
          },
          mappings: {
            properties: {
              firstName: {
                type: 'text',
                analyzer: 'firstname'
              },
              lastName: {
                type: 'text',
                analyzer: 'name',
                fields: {
                  value: {
                    type: 'keyword',
                    normalizer: 'caseInsensitiveSorting'
                  }
                }
              },
              email: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword',
                    normalizer: 'caseInsensitiveSorting'
                  }
                }
              },
              pilLicenceNumber: {
                type: 'keyword',
                normalizer: 'licenceNumber'
              }
            }
          }
        }
      });
    });
};

module.exports = (schema, esClient, options = {}) => {
  const { Profile } = schema;

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
      return Profile.query()
        .where(builder => {
          if (options.id) {
            builder.where({ id: options.id });
          }
        })
        .where({ asruUser: false })
        .select(columnsToIndex)
        .withGraphFetched('establishments');
    })
    .then(profiles => {
      console.log(`Indexing ${profiles.length} profiles`);
      return profiles.reduce((p, profile) => {
        return p.then(() => indexProfile(esClient, profile));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
