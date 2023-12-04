import express from 'express';
import dotenv from 'dotenv';
import teamroutes from './routes/team';

const app = express();
app.use(express.json());
dotenv.config();

app.use('/team', teamroutes);

const port = process.env.API_PORT || 3000;
app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`),
);
