try {
  // eslint-disable-next-line implicit-dependencies/no-implicit
  require('dotenv').config();
} catch (e) {}

const config = require('../../config');
const Schema = require('@asl/schema');
const { Value } = require('slate');
const { isPlainObject, pick, get } = require('lodash');
const isUUID = require('uuid-validate');
const createESClient = require('../create-es-client');

const { Project, ProjectVersion } = Schema(config.db);

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

const indexProject = (client, project) => {
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
      return client.index({
        index: 'projects',
        id: project.id,
        body: {
          id: project.id,
          title: data.title,
          establishment: pick(project.establishment, 'id', 'name'),
          content: [project.licenceHolder.firstName, project.licenceHolder.lastName, content].join(' ')
        }
      });
    });
};

const start = process.hrtime();

Promise.resolve()
  .then(() => createESClient(config.es))
  .then(esClient => {
    return Promise.resolve()
      .then(() => {
        return Project.query()
          .select('title', 'id')
          .withGraphFetched('[licenceHolder,establishment]')
          .where({ status: 'active' });
      })
      .then(projects => {
        console.log(`Indexing ${projects.length} projects`);
        return projects.reduce((p, project) => {
          return p.then(() => indexProject(esClient, project));
        }, Promise.resolve());
      })
      .then(() => esClient.indices.refresh({ index: 'projects' }));
  })
  .then(() => {
    console.log('Done!');
    const end = process.hrtime(start);
    console.log(`Indexing took: ${(end[0] * 1000) + Math.round(end[1] / 1e6)}ms`);
    process.exit();
  })
  .catch(e => {
    const error = get(e, 'meta.body.error');
    if (error) {
      console.error(error);
    } else {
      console.log(e);
    }
    process.exit(1);
  });
