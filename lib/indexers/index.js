const { Router } = require('express');
const winston = require('winston');
const aslSchema = require('../db');
const taskflowDb = require('../db/taskflow');
const { NotFoundError } = require('@asl/service/errors');

const logger = winston.createLogger({
  level: 'debug',
  transports: [ new winston.transports.Console({ level: process.env.LOG_LEVEL || 'info' }) ]
});

const indexers = {
  establishments: require('./establishments'),
  enforcements: require('./enforcements'),
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
    const options = { id: req.params.id };

    return Promise.resolve(settings.esClient)
      .then(client => {
        switch (req.params.index) {
          case 'establishments':
            return Promise.all([
              indexers.establishments(aslSchema, client, options),
              indexers.places(aslSchema, client, { establishmentId: req.params.id })
            ]);

          case 'projects':
            return Promise.all([
              indexers.projects(aslSchema, client, options),
              indexers['projects-content'](aslSchema, client, options)
            ]);

          case 'tasks':
            return indexers.tasks({ aslSchema, taskflowDb, esClient: client, logger, options });

          default:
            return indexers[req.params.index](aslSchema, client, options);
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
