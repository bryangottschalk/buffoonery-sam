const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION
});

const { TABLE_NAME } = process.env;

const getGameroom = async (key, tablename) => {
  const result = await ddb
    .get({
      TableName: tablename,
      Key: { roomcode: key }
    })
    .promise();
  return result.Item;
};

exports.handler = async (event) => {
  console.log('EVENT:', event);
  console.log('process.env', process.env);

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: 'da6wisihu2.execute-api.us-east-1.amazonaws.com' + '/' + 'dev'
  });
  let postData, gameroom;

  if (event.body) {
    postData = JSON.parse(event.body).data;
    console.log(
      '🚀 ~ file: index.js ~ line 34 ~ exports.handler= ~ postData',
      postData
    );
  }

  if (postData && postData.roomcode) {
    gameroom = await getGameroom(postData.roomcode, process.env.TABLE_NAME);
    if (postData.hasOwnProperty('comment')) {
      gameroom.comments.push(postData.comment);
    }
    // notify clients in room of new comment
    gameroom.connectedClients.map(async (client) => {
      try {
        await apigwManagementApi
          .postToConnection({
            ConnectionId: client.connectionId,
            Data: JSON.stringify({
              topic: 'Comment Received',
              comment: postData.comment
            })
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
  }

  if (
    event.Records &&
    event.Records[0] &&
    event.Records[0].Sns &&
    event.Records[0].Sns.Message
  ) {
    console.log('SNS MESSAGE', event.Records[0].Sns.Message);
    const snsMessage = event.Records[0].Sns.Message;
    console.log('snsMessage', snsMessage);
    const roomcode = JSON.parse(snsMessage).roomcode;
    console.log('roomcode from SNS disconnect', roomcode);
    try {
      gameroom = await getGameroom(roomcode, process.env.TABLE_NAME);
    } catch (err) {
      console.log('error getting gameroom with roomcode', err);
    }
    console.log('GAMEROOM:', gameroom);
    if (gameroom && gameroom.connectedClients.length > 0) {
      // inform other clients in the room that a client has disconnected
      gameroom.connectedClients.map(async (client) => {
        try {
          await apigwManagementApi
            .postToConnection({
              ConnectionId: client.connectionId,
              Data: JSON.stringify(snsMessage)
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
    }
  }

  const putParams = {
    TableName: process.env.TABLE_NAME,
    Item: gameroom
  };

  try {
    await ddb.put(putParams).promise();
  } catch (err) {
    return {
      statusCode: 500,
      body: 'Failed to connect: ' + JSON.stringify(err)
    };
  }
  return { statusCode: 200, body: 'Data sent.' };
};
