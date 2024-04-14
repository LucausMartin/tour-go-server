import Koa from 'koa';
import cors from 'koa2-cors';
import koaBody from 'koa-body';
import usersRouter from './routes/users';
import koajwt from 'koa-jwt';
import { formatResponse } from '../utils/common';
import { SECRET } from './global';
import path from 'path';
import koaStatic from 'koa-static';
import plansRouter from './routes/plans';

const app = new Koa();
app.use(cors());
app.use(
  koaBody({
    multipart: true,
    formidable: {
      uploadDir: path.join(__dirname, 'public/images/avatar/'),
      keepExtensions: true
    }
  })
);

app.use(koaStatic(path.join(__dirname, 'public/images/avatar/')));

// 错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if ((err as { status: number }).status === 401) {
      ctx.status;
      ctx.body = formatResponse(401, 'fail', 'Protected resource, use Authorization header to get access\n');
    }
  }
});

// 添加 /api 前缀
// 除去下面之外的接口都需要 token
app.use(
  koajwt({
    secret: SECRET
  }).unless({
    path: [
      /^\/api\/users\/login/,
      /^\/api\/users\/get-publick-key/,
      /^\/api\/users\/has/,
      /^\/api\/users\/register/,
      /^\/api\/users\/forget-password/,
      /^\/api\/users\/change-password/
    ]
  })
);

app.use(usersRouter.routes()).use(usersRouter.allowedMethods());
app.use(plansRouter.routes()).use(plansRouter.allowedMethods());
app.listen(3000, () => {
  console.log('server is running at http://localhost:3000');
});
