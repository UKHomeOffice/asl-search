const api = require('@asl/service/api');
const errorHandler = require('@asl/service/lib/error-handler');
const { NotFoundError } = require('@asl/service/errors');
const search = require('./router/search');
const indexer = require('./router/indexer');

module.exports = (settings) => {

  const app = api(settings);

  app.use('/', search(settings));
  app.use('/', indexer(settings));

  app.use((req, res, next) => {
    if (res.response) {
      const response = {
        data: res.response,
        meta: Object.assign({}, res.meta)
      };
      return res.json(response);
    }
    next();
  });

  app.use((req, res, next) => {
    next(new NotFoundError());
  });

  app.use(errorHandler(settings));

  return app;
};
