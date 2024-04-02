import Router from 'koa-router';
import Connect from '../connect';
import { formatResponse } from '../../utils/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import NodeRSA from 'node-rsa';
import Bcrypt from 'bcryptjs';
import JWT from 'jsonwebtoken';
import { SECRET, IP } from '../global';
import fs from 'fs';

interface User {
  user_name: string;
  name: string;
  follow: number;
  follower: number;
  plan: number;
  bio: string;
  like: number;
  collect: number;
  draft: number;
  history: number;
  avatar: string;
}

const salt = Bcrypt.genSaltSync(10);

const RSA = new NodeRSA({ b: 512 });
RSA.setOptions({ encryptionScheme: 'pkcs1' });

const router = new Router({
  prefix: '/api/users'
});

router.get('/get-publick-key', async ctx => {
  const publicKey = RSA.exportKey(); // 生成公钥
  ctx.body = formatResponse(200, 'success', { publicKey });
});

router.get('/list', async ctx => {
  try {
    const [result] = await Connect.query('SELECT user_name FROM users');
    const usersRes: User[] = Array.isArray(result) ? result.map(row => row as User) : [];
    const users = usersRes.map(user => user.user_name);
    ctx.body = formatResponse(200, 'success', { users });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/has', async ctx => {
  try {
    const { username } = JSON.parse(ctx.request.body) as { username: string };
    console.log(ctx.request.body);
    console.log(username);
    const [result] = await Connect.query('SELECT user_name FROM users WHERE user_name = ?', [username]);
    console.log(result);
    const hasUser = Array.isArray(result) && result.length > 0;
    ctx.body = formatResponse(200, 'success', { hasUser });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/login', async ctx => {
  try {
    const { username, password } = JSON.parse(ctx.request.body) as { username: string; password: string };

    // 查询数据库里的密码
    const [daPassword] = (await Connect.query('SELECT password FROM users WHERE user_name = ?', [
      username
    ])) as RowDataPacket[];
    // 解密前端密码
    const realPassword = RSA.decrypt(password, 'utf8');
    // 验证密码
    const passwordCorrect = Bcrypt.compareSync(realPassword, daPassword[0].password);

    if (passwordCorrect) {
      // 生成 JWT
      const token = JWT.sign({ username: username }, SECRET, { expiresIn: '168h' });
      // 生成当前时间戳
      const time = new Date().getTime();
      ctx.body = formatResponse(200, 'success', { token, time });
    } else {
      ctx.body = formatResponse(503, 'fail', 'Incorrect password');
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/register', async ctx => {
  try {
    const { username, password, name, certifyCharacters } = JSON.parse(ctx.request.body) as {
      username: string;
      password: string;
      certifyCharacters: string;
      name: string;
    };

    // 解密再进行加密
    const hashedPassword = Bcrypt.hashSync(RSA.decrypt(password, 'utf8'), salt);
    const hashedCertifyCharacters = Bcrypt.hashSync(RSA.decrypt(certifyCharacters, 'utf8'), salt);

    // 存储密文
    const [result] = (await Connect.query(
      'INSERT INTO users (user_name, password, name, certify_characters) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name, hashedCertifyCharacters]
    )) as ResultSetHeader[];
    if (result.affectedRows === 1) {
      ctx.body = formatResponse(200, 'success', 'Register successfully');
    } else {
      ctx.body = formatResponse(500, 'fail', 'Register failed');
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.get('/self-info', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const [result] = (await Connect.query('SELECT * FROM users WHERE user_name = ?', [username])) as RowDataPacket[];
    const user = result[0] as User;
    // 只要 user_name name follow follower plan bio like collect 字段、
    const { user_name, name, follow, follower, plan, bio, like, collect, draft, history, avatar } = user;
    ctx.body = formatResponse(200, 'success', {
      user_name,
      name,
      follow,
      follower,
      plan,
      bio,
      like,
      collect,
      draft,
      history,
      avatar: avatar ? `${IP}/${avatar}` : ''
    });
  } catch (err) {
    if (err instanceof Error) {
      ctx.body = formatResponse(500, 'fail', err.message);
    }
  }
});

router.post('/forget-password', async ctx => {
  try {
    // 获取用户名
    const { username, certifyCharacters } = JSON.parse(ctx.request.body) as {
      username: string;
      certifyCharacters: string;
    };
    const hashedCertifyCharacters = RSA.decrypt(certifyCharacters, 'utf8');
    // 对照数据库
    const [result] = (await Connect.query('SELECT certify_characters FROM users WHERE user_name = ?', [
      username
    ])) as RowDataPacket[];
    // 获取密文
    const { certify_characters } = result[0];
    // 对比密文
    const isCorrect = Bcrypt.compareSync(hashedCertifyCharacters, certify_characters);

    if (isCorrect) {
      return (ctx.body = formatResponse(200, 'success', 'Certify successfully'));
    } else {
      return (ctx.body = formatResponse(400, 'success', 'Certify error'));
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
      console.log(error);
    }
  }
});

router.post('/change-password', async ctx => {
  try {
    const { username, password } = JSON.parse(ctx.request.body) as { username: string; password: string };
    console.log(username, password);
    const hashedPassword = Bcrypt.hashSync(RSA.decrypt(password, 'utf8'), salt);
    const [result] = (await Connect.query('UPDATE users SET password = ? WHERE user_name = ?', [
      hashedPassword,
      username
    ])) as ResultSetHeader[];
    console.log(result);
    if (result.affectedRows === 1) {
      ctx.body = formatResponse(200, 'success', 'Change password successfully');
    } else {
      ctx.body = formatResponse(500, 'fail', 'Change password failed');
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
      console.log(error);
    }
  }
});

router.post('/change-avatar', async ctx => {
  try {
    // 获取前端传来的图片
    if (!Array.isArray(ctx.request.files!.avatar)) {
      const token = ctx.request.headers.authorization as string;
      const decoded = JWT.verify(token.split(' ')[1], SECRET);
      const { username } = decoded as { username: string };
      const avatarName = ctx.request.files!.avatar.newFilename;

      // 查询数据库原本的文件名
      const [result] = (await Connect.query('SELECT avatar FROM users WHERE user_name = ?', [
        username
      ])) as RowDataPacket[];
      // 删除原本的文件
      if (result.length > 0) {
        const oldAvatarName = result[0].avatar;
        if (oldAvatarName) {
          // 删除原本的文件
          fs.unlinkSync(`src/public/images/avatar/${oldAvatarName}`);
        }
      }

      // 更新数据库
      const [res] = (await Connect.query('UPDATE users SET avatar = ? WHERE user_name = ?', [
        avatarName,
        username
      ])) as ResultSetHeader[];
      if (res.affectedRows === 1) {
        ctx.body = formatResponse(200, 'success', 'Change avatar successfully');
      } else {
        ctx.body = formatResponse(500, 'fail', 'Change avatar failed');
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (!Array.isArray(ctx.request.files!.avatar)) {
        const avatarName = ctx.request.files!.avatar.newFilename;
        fs.unlinkSync(`src/public/images/avatar/${avatarName}`);
      }
      ctx.body = formatResponse(500, 'fail', error.message);
      console.log(error);
    }
  }
});

router.post('/change-info', async ctx => {
  try {
    const token = ctx.request.headers.authorization as string;
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };

    // 获取前端传来的 name 和 bio
    const { name, bio } = JSON.parse(ctx.request.body) as { name: string; bio: string };

    // 更新数据库
    const [result] = (await Connect.query('UPDATE users SET name = ?, bio = ? WHERE user_name = ?', [
      name,
      bio,
      username
    ])) as ResultSetHeader[];
    if (result.affectedRows === 1) {
      ctx.body = formatResponse(200, 'success', 'Change info successfully');
    } else {
      ctx.body = formatResponse(500, 'fail', 'Change info failed');
    }
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
      console.log(error);
    }
  }
});

export default router;
