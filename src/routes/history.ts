import Router from 'koa-router';
import Connect from '../connect';
// import { SECRET } from '../global';
// import JWT from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import JWT from 'jsonwebtoken';
import { formatResponse } from '../../utils/common';
import { SECRET } from '../global';
import generateUUID from '../../utils/uuidMiddleWare';

const router = new Router({
  prefix: '/api/histories'
});

// 添加点赞
router.post('/add-history', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { article_id } = JSON.parse(ctx.request.body);
    // 查看是否已经添加过历史记录
    const [rows] = (await Connection.query('SELECT * FROM histories WHERE user = ? AND article_id = ?', [
      username,
      article_id
    ])) as RowDataPacket[];
    if (rows.length) {
      ctx.body = formatResponse(200, 'success', 'Already added history');
      return;
    } else {
      // 添加历史记录
      await Connection.query('INSERT INTO histories (history_id, user, `article_id`) VALUES (?, ?, ?)', [
        generateUUID(),
        username,
        article_id
      ]);
      ctx.body = formatResponse(200, 'success', 'Add history successfully');
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 获取历史记录列表
router.get('/get-histories', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const [rows] = (await Connection.query('SELECT * FROM histories WHERE user = ?', [username])) as RowDataPacket[];
    for (let i = 0; i < rows.length; i++) {
      const [article] = (await Connection.query('SELECT user FROM articles WHERE article_id = ?', [
        rows[i].article_id
      ])) as RowDataPacket[];
      rows[i].user = article[0].user;
    }
    // article_id 和 user 一样的去重
    const hash: { [key: string]: boolean } = {};
    const rowsTemp = rows.reduce((item: RowDataPacket, next: RowDataPacket) => {
      hash[next.article_id] ? '' : (hash[next.article_id] = true && item.push(next));
      return item;
    }, []);
    ctx.body = formatResponse(200, 'success', { histories: rowsTemp });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

export default router;
