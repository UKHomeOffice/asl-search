const sortParams = require('../helpers/sort-params');

const index = 'tasks';
const sortable = ['projectTitle', 'licenceHolder.lastName', 'establishment.name', 'status'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.query = { bool: {} };

  if (query.limit && parseInt(query.limit, 10) > 100) {
    params.body.highlight = {};
  }

  if (query.filters) {

  }

  if (!term) {
    return client.search(params);
  }

  const fields = [
    'licenceNumber',
    'licenceHolder.firstName',
    'licenceHolder.lastName',
    'establishment.name',
    'projectTitle'
  ];

  const tokeniser = await client.indices.analyze({ index, body: { text: term } });
  const tokens = tokeniser.body.tokens.map(t => t.token);

  params.body.query.bool.minimum_should_match = tokens.length;
  params.body.query.bool.should = [
    ...tokens.map(token => ({
      match: {
        licenceNumber: {
          query: token,
          boost: 2
        }
      }
    })),
    ...tokens.map(token => ({
      multi_match: {
        fields,
        query: token,
        fuzziness: 'AUTO',
        operator: 'and'
      }
    }))
  ];

  return client.search(params);
};
