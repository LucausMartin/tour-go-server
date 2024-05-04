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
  prefix: '/api/searchs'
});

// 添加搜索记录
router.post('/add-search-history', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { article_id } = JSON.parse(ctx.request.body);
    // 查看是否已经添加过搜索记录
    const [rows] = (await Connection.query('SELECT * FROM searchs WHERE user = ? AND article_id = ?', [
      username,
      article_id
    ])) as RowDataPacket[];
    if (rows.length) {
      ctx.body = formatResponse(200, 'success', 'Already added search');
      return;
    } else {
      // 添加搜索记录
      await Connection.query('INSERT INTO searchs (search_id, user, `article_id`, time) VALUES (?, ?, ?, ?)', [
        generateUUID(),
        username,
        article_id,
        new Date().toString()
      ]);
      ctx.body = formatResponse(200, 'success', 'Add search successfully');
    }
    ctx.body = formatResponse(200, 'success', 'Add search successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 模糊搜索文章标题
router.post('/search-articles', async ctx => {
  try {
    // 获取关键字
    const { keyword } = JSON.parse(ctx.request.body);
    // 获取所有文章
    const Connection = await Connect.getConnection();
    const [rows] = (await Connection.query('SELECT * FROM articles')) as RowDataPacket[];
    // 将所有文章的 content 反序列赋值回去
    const result = rows.map((item: RowDataPacket) => {
      item.content = JSON.parse(item.content);
      return item;
    });
    // 过滤出包含关键字的文章
    const articles = result.filter((item: RowDataPacket) => item.content.title.includes(keyword));
    ctx.body = formatResponse(200, 'success', { articles });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 添加搜索内容记录
router.post('/add-search-content-history', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { content } = JSON.parse(ctx.request.body);
    // 查看是否已经添加过搜索记录
    const [rows] = (await Connection.query('SELECT * FROM search_history WHERE user = ? AND content = ?', [
      username,
      content
    ])) as RowDataPacket[];
    if (rows.length) {
      ctx.body = formatResponse(200, 'success', 'Already added search');
      return;
    } else {
      // 添加搜索记录
      await Connection.query('INSERT INTO search_history (id, user, `content`, time) VALUES (?, ?, ?, ?)', [
        generateUUID(),
        username,
        content,
        new Date().toString()
      ]);
      ctx.body = formatResponse(200, 'success', 'Add search successfully');
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

const formatTime = (time: string) => {
  // 将时间戳字符串转换为 Date 对象
  const date = new Date(time);

  // 获取年、月、日、时、分
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 月份是从 0 开始的，所以需要加 1
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // 格式化成 "年-月-日 时:分" 形式
  return year + '-' + month + '-' + day + ' / ' + hours + ':' + minutes;
};

// 获取最近十条搜索记录
router.get('/get-search-content-history', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const [rows] = (await Connection.query('SELECT * FROM search_history WHERE user = ? LIMIT 10', [
      username
    ])) as RowDataPacket[];
    // 按照时间戳排序最新的在前面，数据库是这种类型 Wed May 01 2024 00:56:14 GMT+0800 (China Standard Time)
    rows.sort((a: RowDataPacket, b: RowDataPacket) => {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
    // 将时间戳转换为 yyyy-MM-dd hh:mm:ss
    rows.forEach((item: RowDataPacket) => {
      item.time = formatTime(item.time);
    });
    // 只要 content
    const searchHistory = rows.map((item: RowDataPacket) => item.content);
    ctx.body = formatResponse(200, 'success', { searchHistory });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 获取点赞最多的文章
router.get('/get-most-likes-articles', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    const [rows] = (await Connection.query('SELECT * FROM articles ORDER BY `like` DESC LIMIT 10')) as RowDataPacket[];
    // 将所有文章的 content 反序列赋值回去
    const result = rows.map((item: RowDataPacket) => {
      item.content = JSON.parse(item.content);
      return item;
    });
    ctx.body = formatResponse(200, 'success', { articles: result });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

export default router;
