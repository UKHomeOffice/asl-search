const { isEmpty } = require('lodash');
const sortParams = require('../helpers/sort-params');
const { andFilter } = require('../helpers/filters');

const index = 'tasks';
const sortable = ['updatedAt'];

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, sortable)
  };

  params.body.highlight = {
    fields: {
      '*': { type: 'plain', pre_tags: '**', post_tags: '**' }
    }
  };

  if (query.limit && parseInt(query.limit, 10) > 100) {
    params.body.highlight = {};
  }

  params.body.query = { bool: {} };

  if (query.filters) {
    const andFilters = {};
    params.body.query.bool.filter = [];

    if (query.filters.progress && query.filters.progress[0]) {
      andFilters.open = query.filters.progress[0] === 'open' ? [true] : [false];
    }

    if (query.filters.model && query.filters.model[0]) {
      andFilters.model = query.filters.model;
    }

    if (!isEmpty(andFilters)) {
      params.body.query.bool.filter = params.body.query.bool.filter.concat(andFilter(andFilters));
    }
  }

  if (!term) {
    return client.search(params);
  }

  const nameFields = [
    'subject.firstName',
    'subject.lastName',
    'assignedTo.firstName',
    'assignedTo.lastName'
  ];

  params.body.query.bool.minimum_should_match = 1;

  params.body.query.bool.should = [
    {
      wildcard: {
        licenceNumber: {
          value: `${term}*`
        }
      }
    },
    {
      wildcard: {
        'establishment.name': {
          value: `*${term}*`
        }
      }
    },
    {
      match: {
        projectTitle: {
          query: term,
          operator: 'and'
        }
      }
    },
    ...nameFields.map(field => ({
      match: {
        [field]: {
          query: term,
          fuzziness: 'AUTO'
        }
      }
    }))
  ];

  return client.search(params);
};
