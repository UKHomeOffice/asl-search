const indexes = ['projects', 'profiles', 'establishments'];

module.exports = (client) => (term, index = 'projects') => {
  if (!indexes.includes(index)) {
    throw new Error(`There is no available search index called ${index}`);
  }

  const params = {
    index,
    size: 50,
    body: {
      query: {
        match: {}
      }
    }
  };

  switch (index) {
    case 'projects':
      params.body.query.match = { content: { query: term, fuzziness: 'AUTO' } };
      break;

    default:
      params.body.query.match = { name: { query: term, fuzziness: 'AUTO' } };
      break;
  }

  return Promise.resolve()
    .then(() => client.search(params));
};

module.exports.indexes = indexes;
