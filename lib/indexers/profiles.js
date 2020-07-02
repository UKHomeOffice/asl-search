const { pick } = require('lodash');

const indexName = 'profiles';
const columnsToIndex = ['id', 'title', 'firstName', 'lastName', 'email', 'telephone', 'telephoneAlt', 'postcode'];

const indexProfile = (esClient, profile) => {
  return esClient.index({
    index: indexName,
    id: profile.id,
    body: {
      ...pick(profile, columnsToIndex),
      name: `${profile.title} ${profile.firstName} ${profile.lastName}`,
      establishments: profile.establishments.map(e => pick(e, 'id', 'name'))
    }
  });
};

module.exports = (schema, esClient) => {
  const { Profile } = schema;

  return Promise.resolve()
    .then(() => {
      return Profile.query()
        .select(columnsToIndex)
        .withGraphFetched('[establishments]');
    })
    .then(profiles => {
      console.log(`Indexing ${profiles.length} profiles`);
      return profiles.reduce((p, profile) => {
        return p.then(() => indexProfile(esClient, profile));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
