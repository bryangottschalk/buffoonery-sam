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

const filterOutConnectionId = (connectedClients, connectionIdToRemove) => {
  return connectedClients.filter(
    (c) => c.connectionId !== connectionIdToRemove
  );
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
          // TODO: DELETE THE CONNECTION, NOT THE ROOM
          console.log(
            `Found stale connection line 57, TODO - delete ${client.connectionId} from ${roomcode}`
          );
          // await ddb
          //   .delete({ TableName: TABLE_NAME, Key: { roomcode } })
          //   .promise();
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
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    console.log('snsMessage', snsMessage);
    const roomcode = snsMessage.roomcode;
    const topic = snsMessage.topic;
    console.log('roomcode from SNS disconnect', roomcode);
    try {
      gameroom = await getGameroom(roomcode, process.env.TABLE_NAME);
    } catch (err) {
      console.log('error getting gameroom with roomcode', err);
    }
    console.log('GAMEROOM:', gameroom);
    if (topic === 'Client Disconnected' || topic === 'Client Connected') {
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
              // TODO: DELETE THE CONNECTION, NOT THE ROOM
              console.log(
                `Found stale connection line 98, TODO - delete ${client.connectionId} from ${roomcode}`
              );
              // await ddb
              //   .delete({ TableName: TABLE_NAME, Key: { roomcode } })
              //   .promise();
            } else {
              throw e;
            }
          }
        });
      }
    } else if (snsMessage.topic === 'DistributePromptsToPlayers') {
      console.log('TODO: DISTRIBUTE PROMPTS TO PLAYERS');
    } else {
      console.log('unhandled case in send message function');
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
