const { Router } = require('express');
const aslSchema = require('../db');
const taskflowDb = require('../db/taskflow');
const { NotFoundError } = require('@asl/service/errors');

const indexers = {
  establishments: require('./establishments'),
  projects: require('./projects'),
  'projects-content': require('./projects-content'),
  profiles: require('./profiles'),
  places: require('./places'),
  tasks: require('./tasks')
};

module.exports = (settings) => {
  const app = Router();

  app.param('index', (req, res, next, param) => {
    if (!indexers[param]) {
      throw new NotFoundError();
    }
    next();
  });

  app.put('/:index/:id', (req, res, next) => {
    return Promise.resolve(settings.esClient)
      .then(client => {
        switch (req.params.index) {
          case 'establishments':
            return Promise.all([
              indexers.establishments(aslSchema, client, { id: req.params.id }),
              indexers.places(aslSchema, client, { establishmentId: req.params.id })
            ]);

          case 'projects':
            return Promise.all([
              indexers.projects(aslSchema, client, { id: req.params.id }),
              indexers['projects-content'](aslSchema, client, { id: req.params.id })
            ]);

          case 'tasks':
            return indexers.tasks({ aslSchema, taskflowDb, esClient: client });

          default:
            return indexers[req.params.index](aslSchema, client, { id: req.params.id });
        }
      })
      .then(() => {
        res.json({ message: `Re-indexed ${req.params.index}:${req.params.id}` });
      })
      .catch(next);
  });

  return app;
};

module.exports.indexers = indexers;
