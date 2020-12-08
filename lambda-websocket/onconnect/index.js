// Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION
});

class Gameroom {
  constructor(roomcode) {
    this.roomcode = roomcode;
    this.comments = [];
    this.connectedClients = [];
  }
}

const getGameroom = async (key) => {
  const result = await ddb
    .get({
      TableName: process.env.TABLE_NAME,
      Key: { roomcode: key }
    })
    .promise();
  return result.Item;
};

const validateGameroom = (gameroom) => {
  console.log(
    `Validating gameroom -> ${JSON.stringify(
      gameroom
    )}, against template => ${JSON.stringify(new Gameroom())}`
  );
  Object.keys(new Gameroom()).forEach((prop, i) => {
    if (!gameroom.hasOwnProperty(prop)) {
      gameroom[prop] = new Gameroom()[prop];
    }
  });
  return gameroom;
};

exports.handler = async (event) => {
  let roomcode, name;
  if (event.queryStringParameters) {
    roomcode = event.queryStringParameters.roomcode;
    name = event.queryStringParameters.name;
  }
  if (!roomcode) {
    throw new Error('roomcode must be supplied to identify gameroom');
  }
  let gameroom = await getGameroom(String(roomcode));
  if (!gameroom && roomcode) {
    gameroom = new Gameroom(roomcode);
    gameroom.connectedClients.push(
      {
        connectionId: String(`${event.requestContext.connectionId}`),
        name: name
      }
    );
    console.log('🚀 ~ file: index.js ~ line 43 ~ gameroom', gameroom);
  } else {
    console.log('FOUND GAMEROOM');
    gameroom = validateGameroom(gameroom);
    gameroom.connectedClients.push(
      {
        connectionId: String(`${event.requestContext.connectionId}`),
        name: name
      }
    );
  }
  console.log('🚀 ~ file: index.js ~ line 61 ~ gameroom', gameroom);



  // notify all clients in room of connection
  if (gameroom && gameroom.connectedClients.length > 0) {
    const postCalls = gameroom.connectedClients.map(async (client) => {
      console.log('invoking SNS topic to trigger sendmessage lambda...')
      var params = {
        Message: JSON.stringify({
          msg: `Client ${client.connectionId} has connected - name: ${client.name}`,
          name: client.name,
          roomcode,
          topic: 'Client Connected',
          client
        }),
        TopicArn: 'arn:aws:sns:us-east-1:695097972413:ClientConnected',
      };
      return await new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();
    })
    console.log('postCalls', postCalls)
    try {
      await Promise.all(postCalls);
    } catch (err) {
      console.log('error publishing SNS topic', err)
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

  return { statusCode: 200, body: 'Connected.' };
};
