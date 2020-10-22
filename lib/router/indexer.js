const { Router } = require('express');
const Schema = require('@asl/schema');
const { NotFoundError } = require('@asl/service/errors');
const indexers = require('../indexers');

module.exports = (settings) => {
  const app = Router();
  const db = Schema(settings.db);

  app.param('index', (req, res, next, param) => {
    if (!indexers[param]) {
      throw new NotFoundError();
    }
    next();
  });

  app.put('/:index/:id', (req, res, next) => {
    return Promise.resolve(settings.esClient)
      .then(client => {
        return indexers[req.params.index](db, client, { id: req.params.id });
      })
      .then(() => {
        res.json({ message: `Re-indexed ${req.params.index}:${req.params.id}` });
      })
      .catch(next);
  });

  return app;
};
