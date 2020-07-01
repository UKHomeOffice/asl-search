module.exports = (client) => (term, index = 'projects') => {

  const params = {
    index,
    _source: [
      'id',
      'title',
      'establishment'
    ],
    size: 50,
    body: {
      query: {
        match: {
          content: {
            query: term
          }
        }
      }
    }
  };

  return Promise.resolve()
    .then(() => client.search(params));
};
