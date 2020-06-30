const { get } = require('lodash');
const { Router } = require('express');
const search = require('../search');
const util = require('util');

module.exports = () => {
  const app = Router();

  app.get('/', (req, res, next) => {
    const term = req.query.q;

    return Promise.resolve()
      .then(() => search(term))
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
