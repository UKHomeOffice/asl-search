class ElasticError extends Error {

  constructor(options) {
    super(`${options.type}: ${options.reason}`);
    Object.assign(this, options);
  }

}

module.exports = ElasticError;
