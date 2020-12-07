const sortParams = require('../helpers/sort-params');

const index = 'profiles';
const sortable = ['lastName', 'email'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.highlight = {
    fields: {
      'firstName': { type: 'plain', pre_tags: '**', post_tags: '**' },
      'lastName': { type: 'plain', pre_tags: '**', post_tags: '**' },
      'email': { type: 'plain', pre_tags: '**', post_tags: '**' },
      'pilLicenceNumber': { type: 'plain', pre_tags: '**', post_tags: '**' }
    }
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
            pilLicenceNumber: token
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
