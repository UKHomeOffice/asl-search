const sortParams = require('../helpers/sort-params');

const index = 'projects';
const sortable = ['title', 'licenceHolder.lastName', 'establishment.name', 'licenceNumber', 'status', 'expiryDate'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.query = { bool: {} };

  if (query.filters && query.filters.status && query.filters.status[0]) {
    params.body.query.bool.filter = { term: { status: query.filters.status[0] } };
  }

  if (!term) {
    return client.search(params);
  }

  // search subset of fields
  const fields = [
    'title',
    'licenceHolder.lastName',
    'establishment.name',
    'keywords'
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
