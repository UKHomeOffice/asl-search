const config = require('../../config');
const Schema = require('@asl/schema');
const { Client } = require('@elastic/elasticsearch');
const { Value } = require('slate');
const { isPlainObject, pick } = require('lodash');
const isUUID = require('uuid-validate');

const { Project, ProjectVersion } = Schema(config.db);

const client = new Client({ node: config.elastic.node });

const index = config.elastic.index;

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

const indexProject = project => {
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
        index,
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
Promise.resolve()
  .then(() => {
    return Project.query()
      .select('title', 'id')
      .withGraphFetched('[licenceHolder,establishment]')
      .where({ status: 'active' });
  })
  .then(projects => {
    console.log(`Indexing ${projects.length} projects`);
    return projects.reduce((p, project) => {
      return p.then(() => indexProject(project));
    }, Promise.resolve());
  })
  .then(() => client.indices.refresh({ index }))
  .then(() => {
    console.log('Done!');
    process.exit();
  })
  .catch(e => {
    console.error(e.meta.body.error);
    process.exit(1);
  });
