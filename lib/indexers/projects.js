const { Value } = require('slate');
const { isPlainObject, pick, mapValues } = require('lodash');
const isUUID = require('uuid-validate');

const indexName = 'projects';
const columnsToIndex = ['id', 'title', 'status', 'licenceNumber', 'expiryDate'];

const slateToText = val => {
  if (val[0] !== '{') {
    return val;
  }
  try {
    const obj = Value.fromJSON(JSON.parse(val));
    return obj.document.text;
  } catch (e) {}
  return val;
};

const getKeys = (node, key, keys = {}) => {
  if (Array.isArray(node)) {
    node.forEach((o, i) => {
      getKeys(o, `${key}_${i}`, keys);
    });
  } else if (isPlainObject(node)) {
    Object.keys(node).forEach(k => {
      getKeys(node[k], `${key ? `${key}_` : ''}${k}`, keys);
    });
  } else if (typeof node === 'string' && !isUUID(node)) {
    if (!key.includes('date')) {
      keys[key] = node;
    }
  }
  return keys;
};

const flatten = (data) => {
  return mapValues(getKeys(data), slateToText);
};

const indexProject = (esClient, project, ProjectVersion) => {
  return ProjectVersion.query()
    .where({
      status: 'granted',
      projectId: project.id
    })
    .orderBy('updatedAt', 'desc')
    .first()
    .then(version => {
      const { data } = version || { data: {} };
      const content = flatten(data);

      return esClient.index({
        index: indexName,
        id: project.id,
        body: {
          ...pick(project, columnsToIndex),
          licenceHolder: pick(project.licenceHolder, 'id', 'firstName', 'lastName'),
          establishment: pick(project.establishment, 'id', 'name'),
          content
        }
      });
    });
};

module.exports = (db, esClient) => {
  const { Project, ProjectVersion } = db;

  return Promise.resolve()
    .then(() => esClient.indices.delete({ index: indexName }).catch(() => {}))
    .then(() => {
      return esClient.indices.create({
        index: indexName,
        body: {
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
                fields: {
                  value: {
                    type: 'keyword'
                  }
                }
              },
              licenceHolder: {
                properties: {
                  lastName: {
                    type: 'keyword',
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
              }
            }
          }
        }
      });
    })
    .then(() => {
      return Project.query()
        .select(columnsToIndex)
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
