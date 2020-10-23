const indexes = {
  places: require('./places')
};

module.exports = (client) => {
  const searches = Object.keys(indexes).reduce((o, index) => {
    return {
      ...o,
      [index]: indexes[index](client)
    };
  }, {});

  return ({ establishmentId, indexName, query = {} }) => {
    const index = searches[indexName];

    const defaultParams = {
      index: indexName,
      body: {
        query: {
          bool: {
            filter: [
              {
                term: { establishmentId }
              }
            ]
          }
        }
      }
    };

    return Promise.all([
      index.search({ query, defaultParams }),
      index.getFilters(defaultParams),
      client.count(defaultParams)
    ])
      .then(([results, filters, count]) => {
        results.body.count = count.body.count;
        results.body.filters = filters;
        return results;
      });
  };
};

module.exports.indexes = Object.keys(indexes);
