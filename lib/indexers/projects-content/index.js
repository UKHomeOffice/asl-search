const { pick, get } = require('lodash');
const extractContent = require('./extract-content');

const indexName = 'projects-content';
const columnsToIndex = [
  'id',
  'title',
  'status',
  'licenceNumber',
  'schemaVersion'
];

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
      const content = extractContent(data, project);
      const protocols = (data.protocols || []).map(p => pick(p, 'id', 'title'));
      return esClient.index({
        index: indexName,
        id: project.id,
        body: {
          ...pick(project, columnsToIndex),
          licenceNumber: project.licenceNumber ? project.licenceNumber.toUpperCase() : null,
          licenceHolder: pick(project.licenceHolder, 'id', 'firstName', 'lastName'),
          establishment: pick(project.establishment, 'id', 'name'),
          versionId: version.id,
          protocols,
          content
        }
      });
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
