const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

class Category {
  constructor(category) {
    this.category = category;
    this.prompts = [];
  }
}

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
  const { category: categoryName } = JSON.parse(event.body);
  const category = new Category(categoryName);
  try {
    await saveCategory(category);
  } catch (err) {
    return err;
  }
  const response = {
    statusCode: 201,
    body: JSON.stringify('Successfully saved new category.')
  };
  return response;
};
