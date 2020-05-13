module.exports = {
  db: {
    database: process.env.DATABASE_NAME || 'asl',
    host: process.env.DATABASE_HOST,
    password: process.env.DATABASE_PASSWORD || 'test-password',
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USERNAME || 'postgres'
  },
  elastic: {
    node: process.env.ELASTIC_NODE || 'http://localhost:9200',
    index: 'projects'
  }
};
