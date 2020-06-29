const api = require('@asl/service/api');
const db = require('@asl/schema');
const errorHandler = require('@asl/service/lib/error-handler');
const { NotFoundError } = require('@asl/service/errors');
const searchRouter = require('./router/search');

module.exports = (settings) => {

  const app = api(settings);
  const models = db(settings.db);

  app.use((req, res, next) => {
    req.models = models;
    next();
  });

  app.use('/', searchRouter());

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
