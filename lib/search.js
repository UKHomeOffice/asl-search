const indexes = ['projects', 'profiles', 'establishments'];

module.exports = (client) => (term, index = 'projects', query = {}) => {
  if (!indexes.includes(index)) {
    throw new Error(`There is no available search index called ${index}`);
  }

  const filters = query.filters || {};
  const size = parseInt(query.limit, 10) || 10;
  const from = parseInt(query.offset, 10) || 0;

  const params = {
    index,
    size,
    from,
    body: {
      query: {
        bool: {
          must: []
        }
      },
      _source: {
        excludes: 'content.*'
      }
    }
  };

  if (term) {

    if (index === 'projects' && term.match(/^content:/)) {
      // do a full content search
      params.body.query.bool.must.push({
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
            'licenceNumber',
            'establishment.name',
            'content.keywords*'
          ];
          break;

        case 'profiles':
          fields = ['firstName', 'lastName^2', 'email', 'pil.licenceNumber'];
          break;

        case 'establishments':
          fields = ['name', 'licenceNumber'];
          break;
      }

      params.body.query.bool.must.push({
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
