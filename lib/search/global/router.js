const { get, omit } = require('lodash');
const { Router } = require('express');
const { ElasticError, NotFoundError } = require('../../errors');
const search = require('./search');

function combineInactive(statuses) {
  return [
    ...statuses.filter(s => !['transferred', 'revoked', 'expired'].includes(s)),
    'all-inactive'
  ];
}

module.exports = (settings) => {
  const app = Router();

  app.use((req, res, next) => {
    return Promise.resolve(settings.esClient)
      .then(client => {
        req.search = search(client);
      })
      .then(() => next())
      .catch(next);
  });

  app.param('index', (req, res, next, param) => {
    if (!search.indexes.includes(param)) {
      throw new NotFoundError(`There is no available search index called ${param}`);
    }
    next();
  });

  app.get('/:index', (req, res, next) => {
    const term = req.query.q || req.query.search;
    const index = req.params.index;

    return Promise.resolve()
      .then(() => req.search(term, index, req.query))
      .then(response => {
        res.response = response.body.hits.hits.map(r => ({ ...omit(r._source, 'content'), highlight: r.highlight, score: r._score }));
        const filters = [
          {
            key: 'status',
            values: index === 'projects'
              ? combineInactive(response.body.statuses)
              : response.body.statuses
          }
        ];
        if (index === 'projects-content') {
          filters.push({ key: 'species', values: response.body.species });
        }
        res.meta = {
          filters,
          total: response.body.count,
          count: response.body.hits.total.value,
          maxScore: response.body.hits.max_score
        };

        if (response.body.hits.total.relation === 'gte') {
          res.meta.count = res.meta.total;
        }
        req.log('info', { event: 'search', index, term, results: res.meta.count });
      })
      .then(() => next())
      .catch(e => {
        const error = get(e, 'meta.body.error');
        if (error) {
          return next(new ElasticError(error));
        }
        return next(e);
      });
  });

  app.use((req, res, next) => {
    if (res.response) {
      const response = {
        data: res.response,
        meta: Object.assign({}, res.meta)
      };
      return res.json(response);
    }
    next();
  });

  return app;
};
