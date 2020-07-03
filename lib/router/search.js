const { get } = require('lodash');
const { Router } = require('express');
const { NotFoundError, BadRequestError } = require('@asl/service/errors');
const { createESClient } = require('../elasticsearch');
const search = require('../search');

module.exports = (settings) => {
  const app = Router();

  app.use((req, res, next) => {
    return Promise.resolve()
      .then(() => createESClient(settings.es))
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
    const term = req.query.q;
    const index = req.params.index;

    if (!term) {
      throw new BadRequestError('Search term must be defined');
    }

    return Promise.resolve()
      .then(() => req.search(term, index))
      .then(response => {
        res.response = response.body.hits.hits;
        res.meta = {
          count: response.body.hits.total.value,
          maxScore: response.body.hits.max_score
        };
      })
      .then(() => next())
      .catch(e => {
        const error = get(e, 'meta.body.error');
        if (error) {
          return next(new Error(`${error.type}: ${error.reason}`));
        }
        return next(e);
      });
  });

  return app;
};
