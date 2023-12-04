import express from 'express';
import dotenv from 'dotenv';
import teamroutes from './routes/team';
import authroutes from './routes/authentication';

const app = express();
app.use(express.json());
dotenv.config();

app.use('/team', teamroutes);
app.use('/auth', authroutes);

const port = process.env.API_PORT || 3000;
app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`),
);
