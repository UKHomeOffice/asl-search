const { get } = require('lodash');
const { Router } = require('express');
const { createESClient } = require('../elasticsearch');
const search = require('../search');
const util = require('util');

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

  app.get('/', (req, res, next) => {
    const term = req.query.q;
    const index = req.query.i;

    return Promise.resolve()
      .then(() => req.search(term, index))
      .then(response => {
        console.log(util.inspect(response, false, null, true));
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
