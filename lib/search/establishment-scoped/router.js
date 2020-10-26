const { get } = require('lodash');
const { Router } = require('express');
const { ElasticError, NotFoundError } = require('../../errors');
const { createESClient } = require('../../elasticsearch');
const search = require('./search');

module.exports = (settings) => {
  const app = Router();
  const client = createESClient(settings.es);

  app.use((req, res, next) => {
    return Promise.resolve(client)
      .then(esClient => {
        req.search = search(esClient);
      })
      .then(() => next())
      .catch(next);
  });

  app.use((req, res, next) => {
    if (!req.establishmentId) {
      throw new NotFoundError('establishmentId is required');
    }
    next();
  });

  app.param('index', (req, res, next, indexName) => {
    if (!search.indexes.includes(indexName)) {
      throw new NotFoundError(`There is no available search index called ${indexName}`);
    }
    req.indexName = indexName;
    next();
  });

  app.get('/:index', (req, res, next) => {
    const query = req.query;
    query.term = query.q || query.search;
    const indexName = req.indexName;
    const establishmentId = req.establishmentId;

    return Promise.resolve()
      .then(() => req.search({ establishmentId, indexName, query }))
      .then(response => {
        res.response = response.body.hits.hits.map(r => ({ ...r._source, highlight: r.highlight }));
        res.meta = {
          filters: response.body.filters,
          total: response.body.count,
          count: response.body.hits.total.value,
          maxScore: response.body.hits.max_score
        };
        if (response.body.hits.total.relation === 'gte') {
          res.meta.count = res.meta.total;
        }
        req.log('info', { event: 'search', index: indexName, term: query.term, results: res.meta.count });
      })
      .then(() => next())
      .catch(e => {
        const error = get(e, 'meta.body.error');
        if (error) {
          return next(new ElasticError(error));
        }
        return next(e);
      });
  });

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

  return app;
};
