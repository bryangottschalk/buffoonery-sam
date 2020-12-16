// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html
// The $disconnect route is executed after the connection is closed.
// The connection can be closed by the server or by the client. As the connection is already closed when it is executed,
// $disconnect is a best-effort event.
// API Gateway will try its best to deliver the $disconnect event to your integration, but it cannot guarantee delivery.

const AWS = require('aws-sdk');
var https = require('https');
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION
});

const getGameroom = async (key) => {
  const result = await ddb
    .get({
      TableName: process.env.TABLE_NAME,
      Key: { roomcode: key }
    })
    .promise();
  return result.Item;
};

const saveGameroom = async function (room) {
  try {
    await ddb
      .put({
        TableName: process.env.TABLE_NAME,
        Item: room
      })
      .promise();
    console.log('saveToDDB success');
  } catch (err) {
    console.error('saveToDDB error: ', err);
  }
};

exports.handler = async (event, context) => {
  let roomcode, room, disconnectingClient;
  const allData = await ddb
    .scan({ TableName: process.env.TABLE_NAME })
    .promise();
  console.log('all data', allData);
  allData.Items.forEach((d) => {
    d.connectedClients.forEach((client) => {
      if (client.connectionId === event.requestContext.connectionId) {
        disconnectingClient = client;
        console.log('found a match!');
        console.log('disconnectingClient:', disconnectingClient);
        room = d;
        room.connectedClients = room.connectedClients.filter(
          (c) => c.connectionId !== client.connectionId
        );
        console.log(`roomcode=${room.roomcode}`);
        console.log('ROOM', room);
        roomcode = room.roomcode;
      }
    });
  });

  if (roomcode) {
    saveGameroom(room);
  }

  // notify all clients in room of disconnection
  if (room && room.connectedClients.length > 0) {
    const postCalls = room.connectedClients.map(async (client) => {
      console.log('invoking SNS topic to trigger sendmessage lambda...');
      var params = {
        Message: JSON.stringify({
          msg: `Client ${disconnectingClient.connectionId} has disconnected.`,
          roomcode,
          topic: `Client Disconnected`,
          name: disconnectingClient.name,
          connectionId: disconnectingClient.connectionId,
          client
        }),
        TopicArn: 'arn:aws:sns:us-east-1:695097972413:ClientDisconnected'
      };

      return await new AWS.SNS({ apiVersion: '2010-03-31' })
        .publish(params)
        .promise();
    });
    console.log('postCalls', postCalls);
    try {
      await Promise.all(postCalls);
    } catch (err) {
      console.log('error publishing SNS topic', err);
    }
  }
  const deleteParams = {
    TableName: process.env.TABLE_NAME,
    Key: {
      roomcode: event.requestContext.roomcode
    }
  };

  try {
    await ddb.delete(deleteParams).promise();
  } catch (err) {
    return {
      statusCode: 500,
      body: 'Failed to disconnect: ' + JSON.stringify(err)
    };
  }

  return { statusCode: 200, body: 'Disconnected.' };
};
