const { get } = require('lodash');
const indexes = ['projects', 'profiles', 'establishments'];

module.exports = (client) => (term, index = 'projects', query = {}) => {
  if (!indexes.includes(index)) {
    throw new Error(`There is no available search index called ${index}`);
  }

  let sort;
  const filters = query.filters || {};
  const size = parseInt(query.limit, 10) || 10;
  const from = parseInt(query.offset, 10) || 0;

  if (query.sort) {
    sort = { [`${query.sort.column}.value`]: query.sort.ascending === 'true' ? 'asc' : 'desc' };
  } else if (!term) {
    switch (index) {
      case 'establishments':
        sort = { 'name.value': 'asc' };
        break;
      case 'projects':
        sort = { 'title.value': 'asc' };
        break;
      case 'profiles':
        sort = { 'lastName.value': 'asc' };
        break;
    }
  }

  const params = {
    index,
    size,
    from,
    body: {
      sort,
      query: {
        bool: {
          should: []
        }
      },
      _source: {
        excludes: 'content.*'
      }
    }
  };

  const aggregatorParams = {
    index,
    size: 0,
    body: {
      aggs: {
        statuses: {
          terms: { field: 'status' }
        }
      }
    }
  };

  if (term) {

    const words = term.split(' ');

    params.body.query.bool.minimum_should_match = words.length;
    // search subset of fields
    let fields;
    switch (index) {
      case 'projects':
        fields = [
          'title',
          'licenceHolder.lastName',
          'establishment.name',
          'keywords'
        ];

        params.body.query.bool.should.push({
          match: { licenceNumber: term }
        });
        break;

      case 'profiles':
        fields = [
          'firstName',
          'lastName^2',
          'email'
        ];
        params.body.query.bool.should.push({
          match: { 'pil.licenceNumber': term }
        });
        break;

      case 'establishments':
        fields = [
          'name^2',
          'asru.*Name'
        ];
        params.body.query.bool.should.push({
          wildcard: {
            name: {
              value: `${term}*`
            }
          }
        });
        params.body.query.bool.should.push({
          match: {
            licenceNumber: term
          }
        });
        break;
    }
    words.forEach(word => {
      params.body.query.bool.should.push({
        multi_match: {
          fields,
          query: word,
          fuzziness: 'AUTO',
          operator: 'and'
        }
      });
    });

  }

  if (filters.status && filters.status[0] && index !== 'profiles') {
    params.body.query.bool.filter = { term: { status: filters.status[0] } };
  }

  return Promise.resolve()
    .then(() => client.search(params))
    .then(result => {
      return Promise.all([client.count({ index }), client.search(aggregatorParams)])
        .then(([count, statuses]) => {
          result.body.count = count.body.count;
          result.body.statuses = get(statuses.body, 'aggregations.statuses.buckets', []).map(b => b.key).sort();
        })
        .then(() => result);
    });
};

module.exports.indexes = indexes;
