const { get } = require('lodash');

const indexes = {
  projects: require('./projects'),
  'projects-content': require('./projects-content'),
  profiles: require('./profiles'),
  establishments: require('./establishments'),
  enforcements: require('./enforcements'),
  tasks: require('./tasks')
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
          },
          species: {
            terms: {
              field: 'species.value',
              size: 500
            }
          }
        }
      }
    };

    query.term = query.term || term;

    return Promise.resolve()
      .then(() => searches[index](term.trim(), query))
      .then(result => {
        return Promise.all([client.count({ index }), client.search(aggregatorParams)])
          .then(([count, aggregations]) => {
            result.body.count = count.body.count;
            result.body.statuses = get(aggregations.body, 'aggregations.statuses.buckets', []).map(b => b.key).sort();
            result.body.species = get(aggregations.body, 'aggregations.species.buckets', []).map(b => b.key).sort();
          })
          .then(() => result);
      });
  };
};

module.exports.indexes = Object.keys(indexes);
