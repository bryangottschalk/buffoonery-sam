const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const saveCategory = async function (category) {
  try {
    await ddb
      .put({
        TableName: process.env.TableName,
        Item: category
      })
      .promise();
    console.log('saveToDDB success');
  } catch (err) {
    console.error('saveToDDB error: ', err);
  }
};

exports.handler = async (event) => {
  console.log('ENV VARS:', process.env);
  console.log('EVENT:', event);
  const payload = JSON.parse(event.body);
  console.log('PAYLOAD:', payload);
  try {
    await saveCategory(payload);
  } catch (err) {
    return err;
  }
  const response = {
    statusCode: 201,
    body: JSON.stringify('Successfully saved new category.')
  };
  return response;
};
