const sortParams = require('../helpers/sort-params');

const index = 'profiles';
const sortable = ['lastName', 'email'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.query = { bool: {} };

  if (query.filters && query.filters.establishments && query.filters.establishments.includes('unassociated')) {
    params.body.query.bool.must_not = {
      exists: {
        field: 'establishments.id'
      }
    };
  }

  params.body.highlight = {
    fields: {
      '*': { type: 'plain', pre_tags: '**', post_tags: '**' }
    }
  };

  if (!term) {
    return client.search(params);
  }

  params.body.query.bool.should = [
    {
      wildcard: {
        pilLicenceNumber: {
          value: `${term}*`
        }
      }
    },
    {
      match: {
        firstName: {
          query: term,
          fuzziness: 'AUTO',
          // boost: 1.8
        }
      }
    },
    {
      match: {
        lastName: {
          query: term,
          fuzziness: 'AUTO',
          // boost: 2
        }
      }
    },
    {
      match: {
        name: {
          query: term
        }
      }
    },
    {
      match: {
        email: {
          query: term,
          fuzziness: 'AUTO'
        }
      }
    }
  ];

  const util = require('util');
  console.log(util.inspect(params, false, null, true));

  return client.search(params);
};
