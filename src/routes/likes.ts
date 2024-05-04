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
  prefix: '/api/likes'
});

// 添加点赞
router.post('/add-like', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { article_id } = JSON.parse(ctx.request.body);
    Connection.beginTransaction();
    await Connection.query('UPDATE articles SET `like` = `like` + 1 WHERE article_id = ?', [article_id]);
    // 向 likes 表中插入数据
    await Connection.query('INSERT INTO likes (like_id, user, `article_id`) VALUES (?, ?, ?)', [
      generateUUID(),
      username,
      article_id
    ]);
    // users 表中 like 字段加 1
    await Connection.query('UPDATE users SET `like` = `like` + 1 WHERE user_name = ?', [username]);
    // 根据 article_id 查询文章作者
    const [rows] = (await Connection.query('SELECT user FROM articles WHERE article_id = ?', [
      article_id
    ])) as RowDataPacket[];
    // 添加消息
    await Connection.query(
      'INSERT INTO messages (message_id, user_name_send, user_name_receive, message_content, type, time) VALUES (?, ?, ?, ?, ?, ?)',
      [
        generateUUID(),
        username,
        rows[0].user,
        JSON.stringify({
          article_id,
          message: '点赞了你的文章'
        }),
        'like',
        new Date().toString()
      ]
    );
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Add like successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 删除点赞
router.post('/delete-like', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { article_id } = JSON.parse(ctx.request.body);
    Connection.beginTransaction();
    await Connection.query('UPDATE articles SET `like` = `like` - 1 WHERE article_id = ?', [article_id]);
    // 删除 likes 表中的数据
    await Connection.query('DELETE FROM likes WHERE user = ? AND article_id = ?', [username, article_id]);
    // users 表中 like 字段减 1
    await Connection.query('UPDATE users SET `like` = `like` - 1 WHERE user_name = ?', [username]);
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Delete like successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 是否已经点赞
router.post('/has-like', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { article_id } = JSON.parse(ctx.request.body);
    const [rows] = (await Connection.query('SELECT * FROM likes WHERE user = ? AND article_id = ?', [
      username,
      article_id
    ])) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { hasLike: rows.length > 0 });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 获取点赞列表
router.get('/get-likes', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const [rows] = (await Connection.query('SELECT * FROM likes WHERE user = ?', [username])) as RowDataPacket[];
    // 根据每个 like 的 article_id 查询文章属于哪个用户并返回 article_id 和 user_name
    for (let i = 0; i < rows.length; i++) {
      const [article] = (await Connection.query('SELECT user FROM articles WHERE article_id = ?', [
        rows[i].article_id
      ])) as RowDataPacket[];
      rows[i].user = article[0].user;
    }
    ctx.body = formatResponse(200, 'success', { likes: rows });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

export default router;
