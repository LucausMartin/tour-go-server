import Router from 'koa-router';
import Connect from '../connect';
import { SECRET } from '../global';
import JWT from 'jsonwebtoken';
import { formatResponse } from '../../utils/common';
import generateUUID from '../../utils/uuidMiddleWare';
import fs from 'fs';
import { RowDataPacket } from 'mysql2';
import { generateImage } from '../../utils/openAI';
import { spawn } from 'child_process';

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

router.post('/get-recommand-articles', async ctx => {
  // 获取 60 条文章，如果不够 60 条，就获取全部
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { page } = JSON.parse(ctx.request.body) as { page: number };
    // 根据 page 获取文章
    const [rows] = (await Connect.query('SELECT * FROM articles LIMIT ?, ?', [(page - 1) * 25, 25])) as RowDataPacket[];
    const articles = rows.map((row: RowDataPacket) => {
      row.content = JSON.parse(row.content);
      return row;
    });
    // 取出用户的点赞、收藏、浏览、搜索记录
    // 取出用户的收藏
    const [collections] = (await Connect.query('SELECT * FROM collects WHERE user = ?', [username])) as RowDataPacket[];
    // 取出用户的点赞
    const [likes] = (await Connect.query('SELECT * FROM likes WHERE user = ?', [username])) as RowDataPacket[];
    // 取出用户的浏览记录
    const [browses] = (await Connect.query('SELECT * FROM histories WHERE user = ?', [username])) as RowDataPacket[];
    // 取出用户的搜索记录
    const [searches] = (await Connect.query('SELECT * FROM searchs WHERE user = ?', [username])) as RowDataPacket[];
    console.log('start python', collections, likes, browses, searches);
    // 取出需要的内容
    const newArticles = articles.map((article: RowDataPacket) => {
      // 取出每一个的 title 和 text 组成一个字符串
      let newContent = '';

      article.content.plan.forEach((plan: { title: string; text: string }) => {
        newContent += plan.title + plan.text;
      });

      return {
        article_id: article.article_id,
        content: newContent,
        user: article.user,
        human_labels: article.human_labels
      };
    });
    // console.log(JSON.stringify(newArticles));
    console.log('start python', newArticles);
    const pythonProcess = spawn('python', ['src/recommand/index.py', JSON.stringify({ newArticles })]);
    pythonProcess.stdout.on('data', data => {
      console.log(data.toString());
    });
    pythonProcess.stderr.on('data', data => {
      console.log(data.toString());
    });
    // 判断是否已经没有文章了
    if (rows.length === 0) {
      ctx.body = formatResponse(200, 'success', { articles: [], over: true });
      return;
    }
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

// 取出该用户关注的人所有文章
router.get('/get-follow-articles', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const [rows] = (await Connection.query(
      'SELECT * FROM articles WHERE user IN (SELECT follow FROM follows WHERE user = ?)',
      [username]
    )) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { articles: rows });
  } catch (err) {
    console.log(err);
    if (err instanceof Error) {
      ctx.body = formatResponse(500, 'fail', err.message);
    }
  }
});

const labelMap = {
  multiple: '多人行',
  double: '双人行',
  single: '单人行',
  food: '美食',
  sea: '海边',
  mountain: '爬山',
  roadtrips: '自驾游',
  specialForces: '特种兵'
};

//根据标签获取文章
router.post('/get-articles-by-label', async ctx => {
  try {
    const { label } = JSON.parse(ctx.request.body) as { label: string };
    const [rows] = (await Connect.query('SELECT * FROM articles WHERE human_labels LIKE ?', [
      // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'label' implicitly has an 'any' type.
      `%${labelMap[label]}%`
    ])) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { articles: rows });
  } catch (err) {
    console.log(err);
    if (err instanceof Error) {
      ctx.body = formatResponse(500, 'fail', err.message);
    }
  }
});

export default router;
