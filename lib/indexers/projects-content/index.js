const { pick } = require('lodash');
const extractContent = require('./extract-content');
const extractSpecies = require('../projects/extract-species');
const deleteIndex = require('../utils/delete-index');

const indexName = 'projects-content';
const columnsToIndex = [
  'id',
  'title',
  'status',
  'licenceNumber',
  'expiryDate',
  'issueDate',
  'revocationDate',
  'raDate',
  'schemaVersion'
];

function extractPurposes(data) {
  function normalise(value) {
    const vals = {
      'basic-research': 'a',
      'translational-research-1': 'b1',
      'translational-research-2': 'b2',
      'translational-research-3': 'b3',
      'safety-of-drugs': 'c',
      'protection-of-environment': 'd',
      'preservation-of-species': 'e',
      'forensic-enquiries': 'g',
      // legacy
      'purpose-a': 'a',
      'purpose-b1': 'b1',
      'purpose-b2': 'b2',
      'purpose-b3': 'b3',
      'purpose-c': 'c',
      'purpose-d': 'd',
      'purpose-e': 'e',
      'purpose-f': 'f',
      'purpose-g': 'g'
    };

    return vals[value];
  }

  if (data['training-licence']) {
    return 'f';
  }

  return [
    ...(data['permissible-purpose'] || []),
    ...(data['translational-research'] || []),
    // legacy
    ...(data.purpose || []),
    ...(data['purpose-b'] || [])
  ].filter(normalise).map(normalise);
}

const indexProject = (esClient, project, ProjectVersion) => {
  return ProjectVersion.query()
    .where({
      // look for most recent submitted draft for inactive projects
      status: project.status === 'inactive' ? 'submitted' : 'granted',
      projectId: project.id
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .first()
    .then(version => {
      version = version || {};
      const data = version.data || {};
      const protocols = (data.protocols || []).filter(p => p && !p.deleted).map(p => pick(p, 'title'));
      return esClient.index({
        index: indexName,
        id: project.id,
        body: {
          ...pick(project, columnsToIndex),
          licenceNumber: project.licenceNumber ? project.licenceNumber.toUpperCase() : null,
          licenceHolder: pick(project.licenceHolder, 'id', 'firstName', 'lastName'),
          establishment: pick(project.establishment, 'id', 'name'),
          species: extractSpecies(data, project),
          purposes: extractPurposes(data),
          versionId: version.id,
          requiresRa: !!project.raDate,
          continuation: !!data.continuation || !!data['transfer-expiring'],
          protocols,
          content: extractContent(data, project)
        }
      });
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
                  tokenizer: 'standard',
                  filter: ['lowercase', 'stop']
                }
              },
              normalizer: {
                licenceNumber: {
                  type: 'custom',
                  filter: ['lowercase']
                },
                lowercase: {
                  type: 'custom',
                  filter: ['lowercase']
                }
              }
            }
          },
          mappings: {
            properties: {
              title: {
                type: 'text',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              licenceNumber: {
                type: 'keyword',
                normalizer: 'licenceNumber',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              status: {
                type: 'keyword',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              licenceHolder: {
                properties: {
                  lastName: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  }
                }
              },
              establishment: {
                properties: {
                  name: {
                    type: 'text',
                    fields: {
                      value: {
                        type: 'keyword'
                      }
                    }
                  }
                }
              },
              expiryDate: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
                  }
                }
              },
              raDate: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
                  }
                }
              },
              species: {
                type: 'keyword',
                normalizer: 'lowercase',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              purposes: {
                type: 'keyword',
                normalizer: 'lowercase',
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              requiresRa: {
                type: 'boolean'
              },
              continuation: {
                type: 'boolean'
              }
            }
          }
        }
      });
    });
};

module.exports = (db, esClient, options) => {
  const { Project, ProjectVersion } = db;

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
      return Project.query()
        .select(columnsToIndex)
        .where(builder => {
          if (options.id) {
            builder.where({ id: options.id });
          }
        })
        .withGraphFetched('[licenceHolder, establishment]')
        .whereExists(
          Project.relatedQuery('version').where('status', '!=', 'draft')
        );
    })
    .then(projects => {
      console.log(`Indexing ${projects.length} projects`);
      return projects.reduce((p, project) => {
        return p.then(() => indexProject(esClient, project, ProjectVersion));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
