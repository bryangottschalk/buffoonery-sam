const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });
var https = require('https');
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
  console.log('context', context);
  console.log(
    '🚀 ~ file: index.js ~ line 24 ~ exports.handler= ~ event',
    event
  );
  console.log('process.env', process.env);
  console.log('table', process.env.TableName);
  console.log('path', event.pathParameters);
  console.log('querystr', event.queryStringParameters);
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
    body:
      gameroom
        ? JSON.stringify(gameroom)
        : {},
    headers: {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,GET'
    }
  };

  return response;
};

// OLD CODE
// function request(options, data) {
//   return new Promise((resolve, reject) => {
//     var req = https.request(options, function (res) {
//       res.setEncoding('utf8');
//       let responseBody = '';
//       res.on('data', function (chunk) {
//         responseBody += chunk;
//       });
//       res.on('end', () => {
//         resolve(JSON.parse(responseBody));
//       });
//     }).on('error', function (e) {
//       reject(e);
//     });

//     req.write(JSON.stringify(data));
//     req.end();
//   });

// }

// if (
//   gameroom &&
//   Array.isArray(gameroom.connectedClients) &&
//   gameroom.connectedClients.length > 0
// ) {
//   const postCalls = gameroom.connectedClients.map(async (connectionId) => {
//     console.log('connectionId:', connectionId);
//     const objToPost = JSON.stringify({
//       action: 'sendmessage', data: `CLIENT CONNECTED ${connectionId}`
//     })
//     console.log('objToPost', objToPost)
//     try {
//       var options = {
//         host: 'da6wisihu2.execute-api.us-east-1.amazonaws.com',
//         path: '/dev/@connection',
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       };
//       await request(options, objToPost)

//     } catch (e) {
//       if (e.statusCode === 410) {
//         console.log(`Found stale connection, deleting ${roomcode}`);
//         await ddb
//           .delete({ TableName: TABLE_NAME, Key: { roomcode } })
//           .promise();
//       } else {
//         throw e;
//       }
//     }
//   });
//   console.log('postCalls', postCalls)
//   await Promise.all(postCalls);
// }
