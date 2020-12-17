const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const getGameroom = async (key, tablename) => {
  const result = await ddb
    .get({
      TableName: tablename,
      Key: { roomcode: key }
    })
    .promise();

  return result.Item;
};

exports.handler = async (event, context) => {
  let roomcode;
  if (event.pathParameters && event.pathParameters.roomcode) {
    roomcode = event.pathParameters.roomcode;
  } else if (event.queryParameters && event.queryParameters.roomcode) {
    roomcode = event.queryParameters.roomcode;
  } else {
    return {
      statusCode: 404
    };
  }

  const gameroom = await getGameroom(roomcode, process.env.TableName);

  console.log('gameroom:', gameroom);

  const response = {
    statusCode: 200,
    body: gameroom ? JSON.stringify(gameroom) : {},
    headers: {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,GET'
    }
  };

  return response;
};
