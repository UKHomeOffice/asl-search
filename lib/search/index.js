const { get } = require('lodash');
const indexes = {
  projects: require('./projects'),
  profiles: require('./profiles'),
  establishments: require('./establishments')
};

module.exports = (client) => {

  const searches = Object.keys(indexes).reduce((o, index) => {
    return {
      ...o,
      [index]: indexes[index](client)
    };
  }, {});

  return (term = '', index = 'projects', query = {}) => {
    if (!indexes[index]) {
      throw new Error(`There is no available search index called ${index}`);
    }

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

    return Promise.resolve()
      .then(() => searches[index](term.trim(), query))
      .then(result => {
        return Promise.all([client.count({ index }), client.search(aggregatorParams)])
          .then(([count, statuses]) => {
            result.body.count = count.body.count;
            result.body.statuses = get(statuses.body, 'aggregations.statuses.buckets', []).map(b => b.key).sort();
          })
          .then(() => result);
      });
  };
};

module.exports.indexes = Object.keys(indexes);
