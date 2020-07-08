const errors = require('@asl/service/errors');
const ElasticError = require('./elastic');

module.exports = {
  ...errors,
  ElasticError
};
