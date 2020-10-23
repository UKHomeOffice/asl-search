const { Router } = require('express');
const globalSearch = require('./global/router');
const scopedSearch = require('./establishment-scoped/router');

module.exports = (settings) => {
  const app = Router();

  app.param('establishmentId', (req, res, next, establishmentId) => {
    req.establishmentId = parseInt(establishmentId, 10);
    next();
  });

  app.use('/establishment/:establishmentId/', scopedSearch(settings));

  if (settings.enableGlobalSearch) {
    console.log('global search routes enabled');
    app.use('/', globalSearch(settings));
  }

  return app;
};
