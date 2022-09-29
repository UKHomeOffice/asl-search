const { pick } = require('lodash');
const deleteIndex = require('../utils/delete-index');

const indexName = 'enforcements';
const columnsToIndex = ['caseNumber', 'createdAt', 'updatedAt'];

const indexEnforcement = (esClient, enforcement) => {
  return esClient.index({
    index: indexName,
    id: enforcement.id,
    body: {
      ...pick(enforcement, columnsToIndex),
      subjects: enforcement.subjects.map(subject => {
        return {
          profile: subject.profile,
          establishment: subject.establishment.name,
          establishmentKeywords: subject.establishment.keywords,
          flags: subject.flags
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
              }
            }
          },
          mappings: {
            properties: {
              caseNumber: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              createdAt: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
                  }
                }
              },
              updatedAt: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
                  }
                }
              },
              'subjects.name': {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              'subjects.establishment': {
                type: 'text',
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
  const { EnforcementCase } = schema;

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
      return EnforcementCase.query()
        .where(builder => {
          if (options.id) {
            builder.where({ id: options.id });
          }
        })
        .select(columnsToIndex)
        .withGraphFetched('subjects.[establishment, profile, flags.[establishment, profile.establishments, pil.establishment, project.establishment]]');
    })
    .then(enforcements => {
      console.log(`Indexing ${enforcements.length} enforcements`);
      return enforcements.reduce((p, enforcement) => {
        return p.then(() => indexEnforcement(esClient, enforcement));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
