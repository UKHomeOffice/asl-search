const { Value } = require('slate');
const { isPlainObject, pick, mapValues, get } = require('lodash');
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
              status: {
                type: 'keyword'
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
              }
            }
          }
        }
      });
    });
}

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
