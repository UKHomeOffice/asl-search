const AWS = require('aws-sdk');
const { Client } = require('@elastic/elasticsearch');
const { createAWSConnection, awsGetCredentials } = require('@acuris/aws-es-connection');

const createESClient = async (options) => {
  if (options.aws.credentials.key) {
    console.log('creating AWS client');

    AWS.config.update({
      credentials: new AWS.Credentials(options.aws.credentials.key, options.aws.credentials.secret),
      region: options.aws.region
    });

    const awsCredentials = await awsGetCredentials();
    const AWSConnection = createAWSConnection(awsCredentials);

    return new Client({
      ...options.aws.client,
      ...AWSConnection
    });
  }

  console.log('no AWS vars set, creating local client');
  return new Client(options.local.client);
};

module.exports = {
  createESClient
};
