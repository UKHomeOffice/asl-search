const api = require('@asl/service/api');
const errorHandler = require('@asl/service/lib/error-handler');
const { NotFoundError } = require('@asl/service/errors');
const { createESClient } = require('./elasticsearch');
const search = require('./search');
const indexer = require('./indexers');

module.exports = (settings) => {

  settings.esClient = createESClient(settings.es);

  const app = api(settings);

  app.use('/', search(settings));

  if (settings.enableIndexer) {
    console.log('indexer routes enabled');
    app.use('/', indexer(settings));
  }

  app.use((req, res, next) => {
    next(new NotFoundError());
  });

  app.use(errorHandler(settings));

  return app;
};
