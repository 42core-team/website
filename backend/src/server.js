var dotenv = require('dotenv');
var express = require('express');

const app = express();
app.use(express.json());
dotenv.config();

app.get('/', (req, res) => {
  return res.send('Received a GET HTTP method');
});

app.post('/', (req, res) => {
  return res.send('Received a POST HTTP method');
});

app.put('/', (req, res) => {
  return res.send('Received a PUT HTTP method');
});

app.delete('/', (req, res) => {
  return res.send('Received a DELETE HTTP method');
});

app.listen(process.env.API_PORT, () =>
  console.log(`Example app listening on port ${process.env.API_PORT}!`),
);
