import Koa from 'koa';
import cors from 'koa2-cors';
import bodyParser from 'koa-bodyparser';
import usersRouter from './routes/users';

const app = new Koa();
app.use(cors());
app.use(bodyParser());
// 添加 /api 前缀
app.use(usersRouter.routes()).use(usersRouter.allowedMethods());

app.listen(3000, () => {
  console.log('server is running at http://localhost:3000');
});
