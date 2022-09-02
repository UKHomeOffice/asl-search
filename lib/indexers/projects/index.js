const { pick } = require('lodash');
const extractSpecies = require('./extract-species');
const deleteIndex = require('../utils/delete-index');

const indexName = 'projects';
const columnsToIndex = [
  'id',
  'title',
  'status',
  'licenceNumber',
  'issueDate',
  'expiryDate',
  'revocationDate',
  'raDate',
  'refusedDate',
  'suspendedDate',
  'isLegacyStub',
  'schemaVersion'
];

function getEndDate(project) {
  switch (project.status) {
    case 'active':
    case 'expired':
      return project.expiryDate;
    case 'revoked':
      return project.revocationDate;
    case 'transferred':
      return project.transferredOutDate;
  }
  return null;
}

const indexProject = (esClient, project, ProjectVersion) => {
  return ProjectVersion.query()
    .where({
      // look for most recent submitted draft for inactive projects
      status: project.status === 'inactive' ? 'submitted' : 'granted',
      projectId: project.id
    })
    .orderBy('updatedAt', 'desc')
    .first()
    .then(version => {
      version = version || {};
      const data = version.data || {};
      const species = extractSpecies(data, project);
      return Promise.resolve()
        .then(() => {
          return esClient.index({
            index: indexName,
            id: project.id,
            body: {
              ...pick(project, columnsToIndex),
              licenceNumber: project.licenceNumber ? project.licenceNumber.toUpperCase() : null,
              licenceHolder: pick(project.licenceHolder, 'id', 'firstName', 'lastName'),
              establishment: pick(project.establishment, 'id', 'name'),
              endDate: getEndDate(project),
              keywords: data.keywords,
              species
            }
          });
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
                  tokenizer: 'whitespace',
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
              species: {
                type: 'keyword',
                normalizer: 'lowercase',
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
              issueDate: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
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
              revocationDate: {
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
              refusedDate: {
                type: 'date',
                fields: {
                  value: {
                    type: 'date'
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
              },
              endDate: {
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
