// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION
});

const { TABLE_NAME } = process.env;

exports.handler = async (event) => {
  const { connectionId } = event.requestContext;
  console.log('EVENT BODY', event.body);
  let connectionData;

  try {
    connectionData = await ddb
      .scan({ TableName: TABLE_NAME, ProjectionExpression: 'roomcode' })
      .promise();
    console.log('connectionData:', connectionData);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });

  const postData = JSON.parse(event.body).data;
  await apigwManagementApi
    .postToConnection({
      ConnectionId: connectionId,
      Data: 'This is a reply to your message'
    })
    .promise();
  console.log('postData', postData);

  const postCalls = connectionData.Items.map(async ({ roomcode }) => {
    try {
      await apigwManagementApi
        .postToConnection({ roomcode: roomcode, Data: postData })
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

  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: 'Data sent.' };
};
