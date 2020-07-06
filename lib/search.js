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

  if (term) {

    params.body.query.bool.minimum_should_match = 1;

    if (index === 'projects' && term.match(/^content:/)) {
      // do a full content search
      params.body.query.bool.should.push({
        multi_match: {
          fields: [
            'content.*'
          ],
          query: term.replace(/^content:/, '').trim(),
          operator: 'and'
        }
      });
    } else {
      // search subset of fields
      let fields;
      switch (index) {
        case 'projects':
          fields = [
            'title^2',
            'licenceHolder.lastName',
            'establishment.name',
            'content.keywords*'
          ];
          params.body.query.bool.should.push({
            match: { licenceNumber: term }
          });
          break;

        case 'profiles':
          fields = ['firstName', 'lastName^2', 'email'];
          params.body.query.bool.should.push({
            match: { 'pil.licenceNumber': term }
          });
          break;

        case 'establishments':
          fields = ['name'];
          params.body.query.bool.should.push({
            match: { licenceNumber: term }
          });
          break;
      }
      params.body.query.bool.should.push({
        multi_match: {
          fields,
          query: term,
          fuzziness: 'auto'
        }
      });

    }

  }

  if (filters.status && filters.status[0] && index !== 'profiles') {
    params.body.query.bool.filter = { term: { status: filters.status[0] } };
  }

  return Promise.resolve()
    .then(() => client.search(params))
    .then(result => {
      return client.count({ index })
        .then(count => {
          result.body.count = count.body.count;
          return result;
        });
    });
};

module.exports.indexes = indexes;
