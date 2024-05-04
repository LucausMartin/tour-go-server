import Router from 'koa-router';
import Connect from '../connect';
import { SECRET } from '../global';
import JWT from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import { formatResponse } from '../../utils/common';

const router = new Router({
  prefix: '/api/messages'
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

router.get('/get-unread-messages', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const [rows] = (await Connect.query('SELECT * FROM messages WHERE user_name_receive = ?', [
      username
    ])) as RowDataPacket[];
    // 按照时间排成降序
    rows.sort((a: RowDataPacket, b: RowDataPacket) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const likeCollects = rows.filter((row: RowDataPacket) => row.type === 'like' || row.type === 'collect');
    const comments = rows.filter((row: RowDataPacket) => row.type === 'comment');
    const follows = rows.filter((row: RowDataPacket) => row.type === 'follow');
    const shares = rows.filter((row: RowDataPacket) => row.type === 'share');
    // 已读在后未读在前
    likeCollects.sort((a: RowDataPacket, b: RowDataPacket) => (a.read === b.read ? 0 : a.read ? 1 : -1));
    comments.sort((a: RowDataPacket, b: RowDataPacket) => (a.read === b.read ? 0 : a.read ? 1 : -1));
    follows.sort((a: RowDataPacket, b: RowDataPacket) => (a.read === b.read ? 0 : a.read ? 1 : -1));
    shares.sort((a: RowDataPacket, b: RowDataPacket) => (a.read === b.read ? 0 : a.read ? 1 : -1));
    // 时间转换
    likeCollects.forEach((likeCollect: RowDataPacket) => {
      likeCollect.time = formatTime(likeCollect.time);
    });
    comments.forEach((comment: RowDataPacket) => {
      comment.time = formatTime(comment.time);
    });
    follows.forEach((follow: RowDataPacket) => {
      follow.time = formatTime(follow.time);
    });
    shares.forEach((share: RowDataPacket) => {
      share.time = formatTime(share.time);
    });
    // 计算出未读消息数量
    const unreadCount =
      likeCollects.filter((likeCollect: RowDataPacket) => !likeCollect.read).length +
      comments.filter((comment: RowDataPacket) => !comment.read).length +
      follows.filter((follow: RowDataPacket) => !follow.read).length +
      shares.filter((share: RowDataPacket) => !share.read).length;
    // 计算出分别的未读消息数量
    const likeCollectsUnreadCount = likeCollects.filter((likeCollect: RowDataPacket) => !likeCollect.read).length;
    const commentsUnreadCount = comments.filter((comment: RowDataPacket) => !comment.read).length;
    const followsUnreadCount = follows.filter((follow: RowDataPacket) => !follow.read).length;
    const sharesUnreadCount = shares.filter((share: RowDataPacket) => !share.read).length;
    ctx.body = formatResponse(200, 'success', {
      count: unreadCount,
      typeList: {
        likeCollects: {
          count: likeCollectsUnreadCount,
          list: likeCollects
        },
        comments: {
          count: commentsUnreadCount,
          list: comments
        },
        fans: {
          count: followsUnreadCount,
          list: follows
        },
        shares: {
          count: sharesUnreadCount,
          list: shares
        }
      }
    });
  } catch (error) {
    console.log(error);
  }
});

// 标记消息为已读
router.post('/mark-read', async ctx => {
  try {
    const { message_id } = JSON.parse(ctx.request.body);
    await Connect.query('UPDATE messages SET `read` = 1 WHERE message_id = ?', [message_id]);
    ctx.body = formatResponse(200, 'success', 'Mark read successfully');
  } catch (error) {
    console.log(error);
  }
});

// 删除消息
router.post('/delete-message', async ctx => {
  try {
    const { message_id } = JSON.parse(ctx.request.body);
    await Connect.query('DELETE FROM messages WHERE message_id = ?', [message_id]);
    ctx.body = formatResponse(200, 'success', 'Delete message successfully');
  } catch (error) {
    console.log(error);
  }
});

// 读取全部消息
router.get('/read-all', async ctx => {
  try {
    const token = ctx.request.headers.authorization as string;
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    await Connect.query('UPDATE messages SET `read` = 1 WHERE user_name_receive = ?', [username]);
    ctx.body = formatResponse(200, 'success', 'Read all messages successfully');
  } catch (error) {
    console.log(error);
  }
});

export default router;
