import Router from 'koa-router';

const router = new Router({
  prefix: '/api/message'
});

router.get('/get-unread-count', async ctx => {
  console.log(ctx, 'get-unread-count');
});
