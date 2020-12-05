const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const getGameroom = async (key, tablename) => {
  console.log(
    '🚀 ~ file: index.js ~ line 6 ~ getGameroom ~ tablename',
    tablename
  );
  console.log('key', key);
  console.log('tablename', process.env.TableName);
  const result = await ddb
    .get({
      TableName: tablename,
      Key: { roomcode: key }
    })
    .promise();
  console.log('🚀 ~ file: index.js ~ line 10 ~ getGameroom ~ result', result);

  return result.Item;
};

exports.handler = async (event) => {
  console.log(
    '🚀 ~ file: index.js ~ line 24 ~ exports.handler= ~ event',
    event
  );
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  console.log('process.env', process.env);
  console.log('table', process.env.TableName);
  console.log('path', event.pathParameters);
  console.log('querystr', event.queryStringParameters);
  let gameroomId;
  if (event.pathParameters && event.pathParameters.gameroomId) {
    gameroomId = event.pathParameters.gameroomId;
  } else if (event.queryParameters && event.queryParameters.gameroomId) {
    gameroomId = event.queryParameters.gameroomId;
  } else {
    return {
      statusCode: 404
    };
  }

  const gameroom = await getGameroom(gameroomId, process.env.TableName);

  console.log(
    '🚀 ~ file: index.js ~ line 38 ~ exports.handler= ~ gameroom',
    gameroom
  );
  if (
    gameroom &&
    Array.isArray(gameroom.connectedClients) &&
    gameroom.connectedClients.length > 0
  ) {
    const postCalls = gameroom.connectedClients.map(async (connectionId) => {
      console.log('🚀 ~ file: index.js ~ line 58 ~ connectionId', connectionId);
      try {
        await apigwManagementApi
          .postToConnection({
            ConnectionId: connectionId,
            Data: connectionId
          })
          .promise();
      } catch (e) {
        if (e.statusCode === 410) {
          console.log(`Found stale connection, deleting ${roomcode}`);
          await ddb
            .delete({ TableName: TABLE_NAME, Key: { roomcode } })
            .promise();
        } else {
          throw e;
        }
      }
    });
    await Promise.all(postCalls);
  }
  const response = {
    statusCode: 200,
    body:
      gameroom && gameroom.connectedClients
        ? JSON.stringify(gameroom.connectedClients)
        : [],
    headers: {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,GET'
    }
  };

  return response;
};
