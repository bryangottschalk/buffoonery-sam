const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION
});

const getCategories = async () => {
  try {
    const params = {
      TableName: process.env.TableName
    };
    const allData = await ddb.scan(params).promise();
    return allData;
  } catch (err) {
    console.log('error getting categories:', err);
  }
};

exports.handler = async (event) => {
  const categories = await getCategories();
  const response = {
    statusCode: 200,
    body: JSON.stringify(categories),
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET'
    }
  };
  return response;
};
