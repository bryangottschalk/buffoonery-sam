const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

const getGameroom = async (key) => {
  const result = await ddb
    .get({
      TableName: process.env.GameroomsTableName,
      Key: { roomcode: key }
    })
    .promise();
  return result.Item;
};

const saveGameroom = async function (room) {
  try {
    await ddb
      .put({
        TableName: process.env.GameroomsTableName,
        Item: room
      })
      .promise();
    console.log('saveToDDB success');
  } catch (err) {
    console.error('saveToDDB error: ', err);
  }
};

const getCategories = async () => {
  try {
    const params = {
      TableName: process.env.CategoriesTableName
    };
    const allData = await ddb.scan(params).promise();
    return allData;
  } catch (err) {
    console.log('error getting categories:', err);
  }
};

exports.handler = async (event) => {
  console.log(
    '🚀 ~ file: index.js ~ line 41 ~ exports.handler= ~ event',
    event
  );
  let roomcode;
  if (event.pathParameters && event.pathParameters.roomcode) {
    roomcode = event.pathParameters.roomcode;
  } else if (event.queryParameters && event.queryParameters.roomcode) {
    roomcode = event.queryParameters.roomcode;
  } else {
    return {
      body: JSON.stringify('You must submit a roomcode with this request.'),
      statusCode: 404
    };
  }
  const gameroom = await getGameroom(roomcode);
  console.log('gameroom:', gameroom);

  const categories = await getCategories();
  console.log('categories', categories);

  const randomPrompts = categories.Items.find((c) => c.category === 'Random')
    .prompts;
  console.log('random prompts:', randomPrompts);

  // assign one random prompt to all clients except for host
  const randomPromptFromRandomList =
    randomPrompts[Math.floor(Math.random() * randomPrompts.length)];

  gameroom.connectedClients.forEach((c) => {
    if (!c.isHost) {
      c.prompts = [{ ...randomPromptFromRandomList }];
    }
  });

  await saveGameroom(gameroom);
  console.log('gameroom after adding prompts', gameroom);

  const response = {
    statusCode: 200,
    body: JSON.stringify('Prompts distributed to players successfully.'),
    headers: {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,PUT'
    }
  };
  return response;
};
