const sortParams = require('./sort-params');

const index = 'profiles';

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(term, query)
  };

  if (!term) {
    return client.search(params);
  }

  // search subset of fields
  const fields = [
    'firstName^1.8',
    'lastName^2',
    'email'
  ];

  const tokeniser = await client.indices.analyze({ index, body: { text: term } });
  const tokens = tokeniser.body.tokens.map(t => t.token);

  params.body.query = {
    bool: {
      minimum_should_match: tokens.length,
      should: [
        ...tokens.map(token => ({
          match: {
            'pil.licenceNumber': token
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
    }
  };

  return client.search(params);
};
