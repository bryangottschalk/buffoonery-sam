// Copyright 2018-2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html
// The $disconnect route is executed after the connection is closed.
// The connection can be closed by the server or by the client. As the connection is already closed when it is executed, 
// $disconnect is a best-effort event. 
// API Gateway will try its best to deliver the $disconnect event to your integration, but it cannot guarantee delivery.

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

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
    logIt('saveToDDB success');
  } catch (err) {
    console.error('saveToDDB error: ', err);
  }
};

exports.handler = async event => {
  let roomcode, room;
  const allData = await ddb.scan({ TableName: process.env.TABLE_NAME }).promise();
  console.log('all data', allData)
  allData.Items.forEach(d => {
    d.connectedClients.forEach(client => {
      if (client === event.requestContext.connectionId) {
        console.log('found a match!')
        room = d;
        d.connectedClients = d.connectedClients.filter(connectionId => connectionId !== client);
        console.log(`roomcode=${d.roomcode}`)
        roomcode = d.roomcode;
      }
    })
  })

  if (roomcode) {
    saveGameroom(room)
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
    return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
  }

  return { statusCode: 200, body: 'Disconnected.' };
};
