module.exports = {
  port: process.env.PORT || 8080,
  verboseErrors: process.env.VERBOSE_ERRORS === 'true',

  elastic: {
    client: {
      node: process.env.ELASTIC_NODE || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTIC_USERNAME,
        password: process.env.ELASTIC_PASSWORD
      },
      maxRetries: 3,
      requestTimeout: 10000
    },
    index: 'projects'
  },

  // auth: {
  //   realm: process.env.KEYCLOAK_REALM,
  //   url: process.env.KEYCLOAK_URL,
  //   client: process.env.KEYCLOAK_CLIENT,
  //   secret: process.env.KEYCLOAK_SECRET,
  //   permissions: process.env.PERMISSIONS_SERVICE
  // },

  db: {
    database: process.env.DATABASE_NAME || 'asl',
    host: process.env.DATABASE_HOST,
    password: process.env.DATABASE_PASSWORD || 'test-password',
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USERNAME || 'postgres',
    application_name: 'search'
  }

};
