import Router from 'koa-router';
import Connect from '../connect';
// import { SECRET } from '../global';
// import JWT from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import { formatResponse } from '../../utils/common';

const router = new Router({
  prefix: '/api/labels'
});

router.get('/get-labels', async ctx => {
  try {
    const [labels] = (await Connect.query('SELECT * FROM labels')) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { labels });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

export default router;
