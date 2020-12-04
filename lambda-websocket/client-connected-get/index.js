const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const getGameroom = async (key, tablename) => {
    console.log('key', key)
    console.log('tablename', process.env.TABLE_NAME)
    const result = await ddb
      .get({
        TableName: process.env.TableName,
        Key: { roomcode: key }
      })
      .promise();
    return result.Item;
  };

exports.handler = async (event) => {
    console.log('process.env', process.env)
    console.log("path", event.pathParameters)
    console.log('querystr', event.queryStringParameters)
    let gameroomId;
    if (event.pathParameters && event.pathParameters.gameroomId) {
      gameroomId = event.pathParameters.gameroomId;
    } else if (
      event.queryParameters &&
      event.queryParameters.gameroomId
    ) {
      gameroomId = event.queryParameters.gameroomId;
    } else {
      return {
        statusCode: 404
      };
    }
  
  const gameroom = await getGameroom(event.pathParameters.gameroomId,);
  
  const response = {
    statusCode: 200,
    body: JSON.stringify(gameroom.connectedClients),
    headers: {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,GET'
    }
  };

  return response;
};
