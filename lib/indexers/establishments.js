const { pick } = require('lodash');

const indexName = 'establishments';
const columnsToIndex = ['id', 'name', 'licenceNumber'];

const indexEstablishment = (esClient, establishment) => {
  return esClient.index({
    index: indexName,
    id: establishment.id,
    body: {
      ...pick(establishment, columnsToIndex)
    }
  });
};

module.exports = (schema, esClient) => {
  const { Establishment } = schema;

  return Promise.resolve()
    .then(() => {
      return Establishment.query()
        .select(columnsToIndex);
    })
    .then(establishments => {
      console.log(`Indexing ${establishments.length} establishments`);
      return establishments.reduce((p, establishment) => {
        return p.then(() => indexEstablishment(esClient, establishment));
      }, Promise.resolve());
    })
    .then(() => esClient.indices.refresh({ index: indexName }));
};
