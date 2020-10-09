const sortParams = require('./sort-params');

const index = 'establishments';
const sortable = ['name', 'status'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(term, query, sortable)
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
    'name^2',
    'asru.*Name',
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
        operator: 'and',
        boost: 1.5
      }
    })),
    ...tokens.map(token => ({
      wildcard: {
        name: {
          value: `${token}*`
        }
      }
    }))
  ];

  return client.search(params);
};
