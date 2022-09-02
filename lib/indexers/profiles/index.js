const { pick } = require('lodash');
const synonyms = require('./synonyms');
const deleteIndex = require('../utils/delete-index');

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
      pilLicenceNumber: profile.pilLicenceNumber ? profile.pilLicenceNumber.toUpperCase() : null,
      pilStatus: profile.pil && (profile.pil.suspendedDate ? 'suspended' : profile.pil.status)
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
            'index.max_result_window': 30000,
            analysis: {
              analyzer: {
                default: {
                  tokenizer: 'whitespace',
                  filter: ['lowercase']
                },
                firstName: {
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding', 'synonyms']
                },
                lastName: {
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding']
                },
                name: {
                  tokenizer: 'ngram',
                  filter: ['lowercase', 'asciifolding']
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
              },
              tokenizer: {
                ngram: {
                  type: 'ngram',
                  min_gram: 4,
                  max_gram: 4,
                  token_chars: ['letter']
                }
              }
            }
          },
          mappings: {
            properties: {
              firstName: {
                type: 'text',
                analyzer: 'firstName'
              },
              lastName: {
                type: 'text',
                analyzer: 'lastName',
                fields: {
                  value: {
                    type: 'keyword',
                    normalizer: 'caseInsensitiveSorting'
                  }
                }
              },
              name: {
                type: 'text',
                analyzer: 'name'
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
              },
              pilStatus: {
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
        .withGraphFetched('[establishments, pil]');
    })
    .then(profiles => {
      console.log(`Indexing ${profiles.length} profiles`);
      return profiles.reduce((p, profile) => {
        return p.then(() => indexProfile(esClient, profile));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
