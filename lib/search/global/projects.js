const sortParams = require('../helpers/sort-params');
const { get, set } = require('lodash');

const index = 'projects';
const sortable = ['title', 'licenceHolder.lastName', 'establishment.name', 'licenceNumber', 'status', 'expiryDate', 'endDate'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.query = { bool: {} };

  params.body.highlight = {
    fields: {
      '*': { type: 'plain', pre_tags: '**', post_tags: '**' }
    }
  };

  if (query.filters || query.species) {
    const term = {};
    const terms = {};
    const status = get(query, 'filters.status[0]');
    if (status) {
      if (status === 'all-inactive') {
        terms.status = [
          'revoked',
          'expired',
          'transferred'
        ];
      } else {
        term.status = status;
      }
    }

    if (query.species) {
      term.species = query.species;
    }
    if (Object.keys(term).length) {
      set(params.body, 'query.bool.filter.term', term);
    }
    if (Object.keys(terms).length) {
      set(params.body, 'query.bool.filter.terms', terms);
    }
  }

  if (!term) {
    return client.search(params);
  }

  // search subset of fields
  const fields = [
    'title',
    'licenceHolder.firstName',
    'licenceHolder.lastName',
    'establishment.name'
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
