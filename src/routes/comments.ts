import Router from 'koa-router';
import Connect from '../connect';
import { RowDataPacket } from 'mysql2';
import JWT from 'jsonwebtoken';
import { formatResponse } from '../../utils/common';
import { SECRET } from '../global';
import generateUUID from '../../utils/uuidMiddleWare';
import { commentScore } from '../../utils/openAI';

const router = new Router({
  prefix: '/api/comments'
});

// 添加评论
router.post('/add-comment', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const Connection = await Connect.getConnection();
    const { article_id, comment, time } = JSON.parse(ctx.request.body);
    const id = generateUUID();
    Connection.beginTransaction();
    await Connection.query('UPDATE articles SET comment = comment + 1 WHERE article_id = ?', [article_id]);
    await Connection.query(
      'INSERT INTO comments (comment_id, user, `article_id`, comment, time) VALUES (?, ?, ?, ?, ?)',
      [id, username, article_id, comment, time]
    );
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
          message: comment
        }),
        'comment',
        new Date().toString()
      ]
    );
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', id);
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

// 更新评论的评分
router.post('/update-score', async ctx => {
  try {
    const { comment_id, comment } = JSON.parse(ctx.request.body);
    // 调用 openAI 评论评分接口
    const openAIText = await commentScore(comment);
    let score = 0;
    // 从文字中提取数字
    if (openAIText === null) {
      score = 5;
    } else {
      score = Number(openAIText.match(/\d+/g)![0]);
    }
    const Connection = await Connect.getConnection();
    await Connection.query('UPDATE comments SET score = ? WHERE comment_id = ?', [score, comment_id]);
    ctx.body = formatResponse(200, 'success', 'Update score successfully');
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
// 获取评论
router.post('/get-comments', async ctx => {
  try {
    const { article_id } = JSON.parse(ctx.request.body);
    const Connection = await Connect.getConnection();
    const [comments] = (await Connection.query('SELECT * FROM comments WHERE article_id = ?', [
      article_id
    ])) as RowDataPacket[];
    // 按照时间戳排序最新的在前面，数据库是这种类型 Wed May 01 2024 00:56:14 GMT+0800 (China Standard Time)
    comments.sort((a: RowDataPacket, b: RowDataPacket) => {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
    // 将时间戳转换为 yyyy-MM-dd hh:mm:ss
    comments.forEach((comment: RowDataPacket) => {
      comment.time = formatTime(comment.time);
    });
    ctx.body = formatResponse(200, 'success', comments);
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

export default router;
