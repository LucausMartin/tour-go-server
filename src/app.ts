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
import articleRouter from './routes/articles';
import labelRouter from './routes/labels';
import likeRouter from './routes/likes';
import collectRouter from './routes/collects';
import commentRouter from './routes/comments';
import messageRouter from './routes/messages';
import historyRouter from './routes/history';
import searchRouter from './routes/searchs';

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
      /^\/api\/users\/other-info/,
      /^\/api\/users\/change-password/,
      /^\/api\/articles\/get-recommand-articles/,
      /^\/api\/articles\/get-article-info/,
      /^\/api\/searchs\/search-articles/,
      /^\/api\/articles\/get-follow-articles/,
      /^\/api\/articles\/get-articles-by-label/
    ]
  })
);

app.use(usersRouter.routes()).use(usersRouter.allowedMethods());
app.use(plansRouter.routes()).use(plansRouter.allowedMethods());
app.use(articleRouter.routes()).use(articleRouter.allowedMethods());
app.use(labelRouter.routes()).use(labelRouter.allowedMethods());
app.use(likeRouter.routes()).use(likeRouter.allowedMethods());
app.use(collectRouter.routes()).use(collectRouter.allowedMethods());
app.use(commentRouter.routes()).use(commentRouter.allowedMethods());
app.use(messageRouter.routes()).use(messageRouter.allowedMethods());
app.use(historyRouter.routes()).use(historyRouter.allowedMethods());
app.use(searchRouter.routes()).use(searchRouter.allowedMethods());
app.listen(3000, () => {
  console.log('server is running at http://localhost:3000');
});
