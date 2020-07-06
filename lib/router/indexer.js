const { Router } = require('express');
const isUUID = require('uuid-validate');
const Schema = require('@asl/schema');
const { NotFoundError } = require('@asl/service/errors');
const { createESClient } = require('../elasticsearch');
const indexers = require('../indexers');

module.exports = (settings) => {
  const app = Router();

  const client = createESClient(settings.es);
  const db = Schema(settings.db);

  app.param('index', (req, res, next, param) => {
    if (!indexers[param]) {
      throw new NotFoundError();
    }
    next();
  });

  app.put('/:index/:id', (req, res, next) => {
    return Promise.resolve(client)
      .then(esClient => {
        return indexers[req.params.index](db, esClient, { id: req.params.id });
      })
      .then(() => {
        res.json({ message: `Re-indexed ${req.params.index}:${req.params.id}` });
      })
      .catch(next);
  });

  return app;
};
