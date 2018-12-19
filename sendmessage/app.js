// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.AWS_REGION });
var DDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });

require("aws-sdk/clients/apigatewaymanagementapi");

exports.handler = function(event, context, callback) {
  var scanParams = {
    TableName: process.env.TABLE_NAME,
    ProjectionExpression: "connectionId"
  };

  DDB.scan(scanParams, function(err, data) {
    if (err) {
      callback(null, {statusCode: 500,body: JSON.stringify(err)});
    } else {
      var apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: "2018-11-29",
        endpoint:
          event.requestContext.domainName + "/" + event.requestContext.stage
      });
      var postParams = {Data: JSON.parse(event.body).data};
      let callbackArray = data.Items.map( async(el) => {postNotifications(apigwManagementApi, postParams, el)});
      Promise.all(callbackArray);

      callback(null, {
        statusCode: 200,
        body: "Data sent."
      });
    }
  });
};

function postNotifications(api, postparams, el){
  var localPostParam = postparams;
  localPostParam.ConnectionId = el.connectionId.S;
  api.postToConnection(localPostParam, function(err) {
    if (err) {
      // API Gateway returns a status of 410 GONE when the connection is no
      // longer available. If this happens, we simply delete the identifier
      // from our DynamoDB table.
      if (err.statusCode === 410) {
        console.log(
          "Found stale connection, deleting " + localPostParam.connectionId
        );
        DDB.deleteItem({
          TableName: process.env.TABLE_NAME,
          Key: { connectionId: { S: localPostParam.connectionId } }
        });
      } 
      else {
        console.log("Failed to post. Error: " + JSON.stringify(err));
      }
    }
    return true;
  });
}