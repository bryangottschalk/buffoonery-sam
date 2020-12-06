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
  if (event.Records) {
    const message = event.Records[0].Sns.Message;
    console.log('IS SNS MESSAGE:', message)
  }
  console.log('event', event)
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  const { connectionId } = event.requestContext;
  const postData = JSON.parse(event.body).data;
  let gameroom;
  if (postData && postData.roomcode) {
    gameroom = await getGameroom(postData.roomcode, process.env.TABLE_NAME);
    console.log('GAMEROOM:', gameroom)
  }
  await apigwManagementApi
    .postToConnection({
      ConnectionId: connectionId,
      Data: 'This is a reply to your message'
    })
    .promise();

  if (gameroom && gameroom.connectedClients.length > 0) {
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


  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: 'Data sent.' };
};
