const indexes = ['projects', 'profiles', 'establishments'];

module.exports = (client) => (term, index = 'projects', filters = {}) => {
  if (!indexes.includes(index)) {
    throw new Error(`There is no available search index called ${index}`);
  }

  const params = {
    index,
    size: 50,
    body: {
      query: {
        bool: {
          must: []
        }
      }
    }
  };

  if (term) {
    switch (index) {
      case 'projects':
        params.body.query.bool.must.push({ match: { search: { query: term, fuzziness: 'AUTO' } } });
        break;

      default:
        params.body.query.bool.must.push({ match: { name: { query: term, fuzziness: 'AUTO' } } });
        break;
    }
  }


  if (filters.status && index !== 'profiles') {
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
