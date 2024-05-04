import Router from 'koa-router';
import Connect from '../connect';
import { SECRET } from '../global';
import JWT from 'jsonwebtoken';
import { formatResponse } from '../../utils/common';
import generateUUID from '../../utils/uuidMiddleWare';
import fs from 'fs';
import { RowDataPacket } from 'mysql2';
import { generateImage } from '../../utils/openAI';

const router = new Router({
  prefix: '/api/articles'
});

router.post('/new-article', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { content, human_labels } = JSON.parse(ctx.request.body);

    Connection.beginTransaction();
    // 插入数据;
    await Connection.query('INSERT INTO articles (article_id, content, user, human_labels) VALUES (?, ?, ?, ?)', [
      generateUUID(),
      JSON.stringify(content),
      username,
      JSON.stringify(human_labels)
    ]);
    await Connection.query('UPDATE users SET article = article + 1 WHERE user_name = ?', [username]);
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Create article successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.get('/get-articles', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };

    // 查询数据
    const [rows] = (await Connect.query('SELECT * FROM articles WHERE user = ?', [username])) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { articles: rows });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/get-article-info', async ctx => {
  try {
    const { articleID } = JSON.parse(ctx.request.body);

    // 查询数据
    const [rows] = (await Connect.query('SELECT * FROM articles WHERE article_id = ?', [articleID])) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { article: rows[0] });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/add-cover', async ctx => {
  try {
    // 获取前端传来的图片
    if (!Array.isArray(ctx.request.files!.avatar)) {
      const coverImg = ctx.request.files!.avatar.newFilename;

      ctx.body = formatResponse(200, 'success', {
        coverImg
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (!Array.isArray(ctx.request.files!.avatar)) {
        const avatarName = ctx.request.files!.avatar.newFilename;
        fs.unlinkSync(`src/public/images/avatar/${avatarName}`);
      }
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/delete-article', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { articleID } = JSON.parse(ctx.request.body) as { articleID: string };

    const Connection = await Connect.getConnection();
    Connection.beginTransaction();
    // 删除数据
    await Connection.query('DELETE FROM articles WHERE article_id = ? AND user = ?', [articleID, username]);

    // 删除用户的 plan 计数
    await Connection.query('UPDATE users SET article = article - 1 WHERE user_name = ?', [username]);
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Delete plan successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.get('/get-recommand-articles', async ctx => {
  // 获取 60 条文章，如果不够 60 条，就获取全部
  try {
    const [rows] = (await Connect.query('SELECT * FROM articles LIMIT ?', [60])) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { articles: rows });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/remove-follow', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    Connection.beginTransaction();
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { removeName } = JSON.parse(ctx.request.body) as { id: string; removeName: string };
    const sql1 = 'DELETE FROM follows WHERE user = ? AND follow = ?';
    const sql2 = 'UPDATE users SET follow = follow - 1 WHERE user_name = ?';
    const sql3 = 'UPDATE users SET follower = follower - 1 WHERE user_name = ?';

    await Connection.query(sql1, [username, removeName]);
    await Connection.query(sql2, [username]);
    await Connection.query(sql3, [removeName]);

    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Remove follow successfully');
  } catch (err) {
    console.log(err);
    if (err instanceof Error) {
      ctx.body = formatResponse(500, 'fail', err.message);
    }
  }
});

router.post('/share', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    Connection.beginTransaction();
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { shareName, article_id } = JSON.parse(ctx.request.body) as { shareName: string; article_id: string };
    await Connection.query(
      'INSERT INTO messages (message_id, user_name_send, user_name_receive, message_content, type, time) VALUES (?, ?, ?, ?, ?, ?)',
      [generateUUID(), username, shareName, article_id, 'share', new Date().toString()]
    );
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'share successfully');
  } catch (err) {
    console.log(err);
    if (err instanceof Error) {
      ctx.body = formatResponse(500, 'fail', err.message);
    }
  }
});

// 生成图片
router.post('/get-img', async ctx => {
  const timer = setTimeout(() => {
    throw new Error('Timeout');
  }, 60000);
  try {
    // 超过一分钟就返回错误
    const { text } = JSON.parse(ctx.request.body);
    const image = await generateImage(text);
    ctx.body = formatResponse(200, 'success', { img: image });
    clearTimeout(timer);
  } catch (err) {
    clearTimeout(timer);
    console.log(err);
    if (err instanceof Error) {
      ctx.body = formatResponse(500, 'fail', err.message);
    }
  }
});

export default router;
