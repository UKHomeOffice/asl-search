const sortParams = require('./sort-params');

const index = 'projects';

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(term, query)
  };

  if (!term) {
    return client.search(params);
  }

  params.body.query = {};

  // search subset of fields
  const fields = [
    'title',
    'licenceHolder.lastName',
    'establishment.name',
    'keywords'
  ];

  const tokeniser = await client.indices.analyze({ index, body: { text: term } });
  const tokens = tokeniser.body.tokens.map(t => t.token);

  params.body.query.bool = {
    minimum_should_match: tokens.length,
    should: [
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
    ]
  };

  if (query.filters && query.filters.status && query.filters.status[0]) {
    params.body.query.bool.filter = { term: { status: query.filters.status[0] } };
  }

  return client.search(params);
};
