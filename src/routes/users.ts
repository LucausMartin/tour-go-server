import Router from 'koa-router';
import Connect from '../connect';
import { formatResponse } from '../../utils/common';

interface User {
  user_name: string;
  // Add other properties if necessary
}

const router = new Router({
  prefix: '/api/users'
});

router.get('/', async ctx => {
  try {
    const [result] = await Connect.query('SELECT user_name FROM users');
    const usersRes: User[] = Array.isArray(result) ? result.map(row => row as User) : [];
    const users = usersRes.map(user => user.user_name);
    ctx.body = formatResponse(200, 'success', { users });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, error.message, {});
    }
  }
});

export default router;
