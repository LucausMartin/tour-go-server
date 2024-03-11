import Router from 'koa-router';
import Connect from '../connect';
import { formatResponse } from '../../utils/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import NodeRSA from 'node-rsa';
import Bcrypt from 'bcryptjs';
import JWT from 'jsonwebtoken';
import { SECRET } from '../global';

interface User {
  user_name: string;
  // Add other properties if necessary
}

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
    const { username } = ctx.request.body as { username: string };
    const [result] = await Connect.query('SELECT user_name FROM users WHERE user_name = ?', [username]);
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
    const { username, password } = ctx.request.body as { username: string; password: string };

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
    const { username, password, name, certifyCharacters } = ctx.request.body as {
      username: string;
      password: string;
      certifyCharacters: string;
      name: string;
    };

    // 生成随机盐
    const salt = Bcrypt.genSaltSync(10);
    // 解密再进行加密
    const hashedPassword = Bcrypt.hashSync(RSA.decrypt(password, 'utf8'), salt);

    // 存储密文
    const [result] = (await Connect.query(
      'INSERT INTO users (user_name, password, name, certify_characters) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, name, certifyCharacters]
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
    const { token } = ctx.request.body as {
      token: string;
    };
    console.log(JWT.decode(token));
  } catch (err) {
    if (err instanceof Error) {
      console.log(err);
    }
  }
});

export default router;
