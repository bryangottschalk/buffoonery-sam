const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const getCategory = async (key) => {
  const result = await ddb
    .get({
      TableName: process.env.TableName,
      Key: { category: key }
    })
    .promise();
  return result.Item;
};

const saveCategoryWithPrompt = async (updatedCategory) => {
  const putParams = {
    TableName: process.env.TableName,
    Item: updatedCategory
  };
  try {
    await ddb.put(putParams).promise();
  } catch (err) {
    return {
      statusCode: 500,
      body: 'Failed to connect: ' + JSON.stringify(err)
    };
  }
};

exports.handler = async (event) => {
  const { category, prompt } = JSON.parse(event.body);

  const categoryToUpdate = await getCategory(category);
  if (categoryToUpdate) {
    categoryToUpdate.prompts.push(prompt);
    await saveCategoryWithPrompt(categoryToUpdate);
  } else {
    const response = {
      statusCode: 404,
      body: JSON.stringify(
        'the category must exist for you to assign a prompt to it.'
      )
    };
    return response;
  }
  const response = {
    statusCode: 204,
    body: JSON.stringify('Prompt successfully added to category.'),
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS'
    }
  };
  return response;
};
