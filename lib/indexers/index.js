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

  // Middleware to validate index params
  app.param('index', (req, res, next, param) => {
    if (!indexers[param]) {
      throw new NotFoundError();
    }
    next();
  });

  app.put('/:index/:id', async (req, res, next) => {
    const options = { id: req.params.id };

    try {
      // Initialize the schema before continuing
      const { schema } = await aslSchema().init();
      const client = settings.esClient;

      switch (req.params.index) {
        case 'establishments':
          await Promise.all([
            indexers.establishments(schema, client, options), // Pass initialized schema
            indexers.places(schema, client, { establishmentId: req.params.id })
          ]);
          break;

        case 'projects':
          await Promise.all([
            indexers.projects(schema, client, options),
            indexers['projects-content'](schema, client, options)
          ]);
          break;

        case 'tasks':
          await indexers.tasks({ schema, taskflowDb, esClient: client, logger, options });
          break;

        default:
          await indexers[req.params.index](schema, client, options);
          break;
      }

      // Send success response
      res.json({ message: `Re-indexed ${req.params.index}:${req.params.id}` });

    } catch (err) {
      next(err); // Pass error to the error handler
    }
  });

  return app;
};

module.exports.indexers = indexers;
