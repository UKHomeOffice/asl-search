const { pick, isEmpty, get, flatten } = require('lodash');
const sortParams = require('../helpers/sort-params');
const { orFilter, andFilter } = require('../helpers/filters');

const index = 'projects-content';

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    timeout: '30s',
    ...sortParams(query, ['title'])
  };

  params.body.query = {
    bool: {}
  };
  params.body.highlight = {
    type: 'plain',
    fragmenter: 'span',
    number_of_fragments: 1,
    pre_tags: '**',
    post_tags: '**',
    fragment_size: 250,
    fields: {
      'content.*': {},
      'title': {
        require_field_match: false
      }
    }
  };

  if (query.limit && parseInt(query.limit, 10) > 100) {
    params.body.highlight = {};
  }

  if (query.filters) {
    const andFilters = {};
    const orFilters = pick(query.filters, ['species', 'status', 'purposes']);

    params.body.query.bool.filter = [];

    if (query.filters.extra) {
      if (query.filters.extra.includes('ra')) {
        andFilters.requiresRa = [true];
      }

      if (query.filters.extra.includes('continuation')) {
        andFilters.continuation = [true];
      }
    }

    if (!isEmpty(orFilters)) {
      params.body.query.bool.filter = params.body.query.bool.filter.concat(orFilter(orFilters));
    }

    if (!isEmpty(andFilters)) {
      params.body.query.bool.filter = params.body.query.bool.filter.concat(andFilter(andFilters));
    }
  }

  if (!term) {
    return client.search(params);
  }

  const fields = flatten((get(query, 'filters.fields') || ['all']).map(f => {
    if (f === 'all') {
      return ['content.*'];
    }
    if (f === 'granted') {
      return ['content.introduction', 'content.action-plan', 'protocols', 'animals-taken-from-the-wild'];
    }
    if (f === 'nts') {
      return ['content.aims', 'content.benefits', 'content.project-harms', 'content.fate-of-animals', 'content.replacement', 'content.reduction', 'content.refinement'];
    }
  }));

  params.body.query.bool.minimum_should_match = 1;
  params.body.query.bool.should = [
    {
      multi_match: {
        fields,
        query: term,
        type: 'phrase',
        operator: 'and'
      }
    },
    {
      match: {
        title: {
          query: term,
          operator: 'and',
          boost: 1.5
        }
      }
    }
  ];

  return client.search(params);
};
