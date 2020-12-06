// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

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
  console.log('EVENT:', event)
  console.log('process.env', process.env)
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: 'da6wisihu2.execute-api.us-east-1.amazonaws.com' + '/' + 'dev'
  });
  let postData, gameroom;

  if (event.body) {
    postData = JSON.parse(event.body).data;
  }
  
  if (postData && postData.roomcode) {
    gameroom = await getGameroom(postData.roomcode, process.env.TABLE_NAME);
  } 



  console.log('GAMEROOM:', gameroom)




  if (event.Records && event.Records[0] && event.Records[0].Sns &&  event.Records[0].Sns.Message) {
    // message is connectionId that has disconnected from a room, ondisconnect publishes to sns topic which triggers this msg
    const disconnectedId = event.Records[0].Sns.Message; // ALSO INCLUDES ROOMCODE IN THE STRING &roomcode =
    console.log('disconnectedId', disconnectedId)
    const roomcode = disconnectedId.slice(disconnectedId.indexOf('&roomcode=') + 10, disconnectedId.length);
    console.log('roomcode from SNS disconnect', roomcode)
    try {
      gameroom = await getGameroom(roomcode, process.env.TABLE_NAME);
    } catch (err) {
      console.log('error getting gameroom with roomcode', err)
    }
    console.log('GAMEROOM:', gameroom)
    console.log('IS SNS MESSAGE, DISCONNECTING CLIENT ID', disconnectedId )
    if (gameroom && gameroom.connectedClients.length > 0) { 
      // inform other clients in the room that a client has disconnected
      gameroom.connectedClients.map(async(connectionId) => {
        try {
          await apigwManagementApi
          .postToConnection({
            ConnectionId: connectionId,
            Data: `Client ${disconnectedId} has disconnected.`
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
      })
    }
    return { statusCode: 200, body: 'Data sent.' };
  }

  if (gameroom && gameroom.connectedClients.length > 0) {
    console.log('informing clients of new connection')
    gameroom.connectedClients.map(async (connectionId) => {
      try {
        await apigwManagementApi
          .postToConnection({ ConnectionId: connectionId, Data: postData.msg })
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

  
  return { statusCode: 200, body: 'Data sent.' };

  // await apigwManagementApi
  // .postToConnection({
  //   ConnectionId: connectionId,
  //   Data: 'This is a reply to your message'
  // })
  // .promise();

};
