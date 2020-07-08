const { get } = require('lodash');
const { Router } = require('express');
const { ElasticError, NotFoundError } = require('../errors');
const { createESClient } = require('../elasticsearch');
const search = require('../search');

module.exports = (settings) => {
  const app = Router();

  const client = createESClient(settings.es);

  app.use((req, res, next) => {
    return Promise.resolve(client)
      .then(esClient => {
        req.search = search(esClient);
      })
      .then(() => next())
      .catch(next);
  });

  app.param('index', (req, res, next, param) => {
    if (!search.indexes.includes(param)) {
      throw new NotFoundError();
    }
    next();
  });

  app.get('/:index', (req, res, next) => {
    const term = req.query.q || req.query.search;
    const index = req.params.index;

    return Promise.resolve()
      .then(() => req.search(term, index, req.query))
      .then(response => {
        res.response = response.body.hits.hits.map(r => ({ ...r._source, highlight: r.highlight }));
        res.meta = {
          filters: response.body.statuses,
          total: response.body.count,
          count: response.body.hits.total.value,
          maxScore: response.body.hits.max_score
        };
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

  return app;
};
