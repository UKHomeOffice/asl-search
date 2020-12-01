const sortParams = require('../helpers/sort-params');

const index = 'projects-content';

module.exports = client => async (term = '', query = {}) => {
  const params = {
    index,
    ...sortParams(query, [])
  };

  params.body.query = {
    bool: {}
  };
  params.body.highlight = {
    fields: {
      'content.*': {
        type: 'plain',
        fragmenter: 'span',
        fragment_size: 250,
        number_of_fragments: 1,
        pre_tags: '**',
        post_tags: '**'
      }
    }
  };

  if (query.filters && query.filters.status && query.filters.status[0]) {
    const filter = { term: {} };
    filter.term.status = query.filters.status[0];
    params.body.query.bool.filter = filter;
  }

  if (!term) {
    return client.search(params);
  }

  // search subset of fields
  const fields = [
    'content.*'
  ];

  params.body.query.bool.minimum_should_match = 1;
  params.body.query.bool.should = [
    {
      multi_match: {
        fields,
        query: term,
        type: 'phrase',
        operator: 'and'
      }
    }
  ];

  return client.search(params);
};
