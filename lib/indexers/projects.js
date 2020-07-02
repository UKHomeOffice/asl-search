const { Value } = require('slate');
const { isPlainObject, pick } = require('lodash');
const isUUID = require('uuid-validate');

const indexName = 'projects';
const columnsToIndex = ['id', 'title', 'licenceNumber'];

const slateToText = val => {
  if (val[0] !== '{') {
    return val;
  }
  try {
    const obj = Value.fromJSON(JSON.parse(val));
    return obj.document.nodes.map(node => node.text.trim()).filter(node => node).join('\n\n');
  } catch (e) {}
  return val;
};

const traverse = (input, buffer = '') => {
  if (isUUID(input)) {
    return buffer;
  }
  if (typeof input === 'string') {
    buffer += slateToText(input);
    buffer += '\n\n';
    return buffer;
  }
  if (Array.isArray(input)) {
    return input.reduce((str, i) => traverse(i, str), buffer);
  }
  if (isPlainObject(input)) {
    return traverse(Object.values(input), buffer);
  }
  return buffer;
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
      const { data } = version;
      const content = traverse(data);
      return esClient.index({
        index: indexName,
        id: project.id,
        body: {
          ...pick(project, columnsToIndex),
          establishment: pick(project.establishment, 'id', 'name'),
          content: [project.licenceHolder.firstName, project.licenceHolder.lastName, content].join(' ')
        }
      });
    });
};

module.exports = (db, esClient) => {
  const { Project, ProjectVersion } = db;

  return Promise.resolve()
    .then(() => {
      return Project.query()
        .select(columnsToIndex)
        .withGraphFetched('[licenceHolder, establishment]')
        .where({ status: 'active' });
    })
    .then(projects => {
      console.log(`Indexing ${projects.length} projects`);
      return projects.reduce((p, project) => {
        return p.then(() => indexProject(esClient, project, ProjectVersion));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
