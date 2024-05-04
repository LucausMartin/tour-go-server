import Router from 'koa-router';
import Connect from '../connect';
import { SECRET } from '../global';
import JWT from 'jsonwebtoken';
import { formatResponse } from '../../utils/common';
import generateUUID from '../../utils/uuidMiddleWare';
import { RowDataPacket } from 'mysql2';

interface PlanType {
  title: string;
  startTime: string;
  endTime: string;
  placeLocation: number;
  cost: number;
  takeThings: string;
  tips: string;
}

interface Plan {
  title: string;
  plan: PlanType[];
}

const router = new Router({
  prefix: '/api/plans'
});

router.post('/new-plan', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { content } = JSON.parse(ctx.request.body) as { content: Plan };

    Connection.beginTransaction();
    // 插入数据;
    await Connection.query('INSERT INTO plans (plan_id, content, user) VALUES (?, ?, ?)', [
      generateUUID(),
      JSON.stringify(content),
      username
    ]);
    await Connection.query('UPDATE users SET plan = plan + 1 WHERE user_name = ?', [username]);
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Create plan successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.get('/get-plans', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };

    // 查询数据
    const [rows] = (await Connect.query('SELECT * FROM plans WHERE user = ?', [username])) as RowDataPacket[];
    ctx.body = formatResponse(200, 'success', { plans: rows });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/change-start-state', async ctx => {
  try {
    const Connection = await Connect.getConnection();
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };

    const { plan_id, state } = JSON.parse(ctx.request.body) as { plan_id: string; state: number };

    Connection.beginTransaction();
    // 如果 state 是 1
    if (state === 1) {
      // 将该用户的plan start 设置为 0
      await Connection.query('UPDATE plans SET start = 0 WHERE user = ?', [username]);

      // 将该用户的该 plan start 设置为 1
      await Connection.query('UPDATE plans SET start = 1 WHERE plan_id = ? AND user = ?', [plan_id, username]);
    } else {
      // 将该用户的该 plan start 设置为 0
      await Connection.query('UPDATE plans SET start = 0 WHERE plan_id = ? AND user = ?', [plan_id, username]);
    }
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Change start state successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/delete-plan', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { plan_id } = JSON.parse(ctx.request.body) as { plan_id: string };

    const Connection = await Connect.getConnection();
    Connection.beginTransaction();
    // 删除数据
    await Connection.query('DELETE FROM plans WHERE plan_id = ? AND user = ?', [plan_id, username]);

    // 删除用户的 plan 计数
    await Connection.query('UPDATE users SET plan = plan - 1 WHERE user_name = ?', [username]);
    await Connection.commit();
    ctx.body = formatResponse(200, 'success', 'Delete plan successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.get('/wait-plans', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };

    // 获取该用户没有开始的计划
    const [rows] = (await Connect.query('SELECT * FROM plans WHERE user = ? AND start = 0', [
      username
    ])) as RowDataPacket[];
    const responseData = rows.map((row: RowDataPacket) => {
      return {
        plan_id: row.plan_id,
        title: JSON.parse(row.content).title
      };
    });

    ctx.body = formatResponse(200, 'success', { plans: responseData });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.get('/get-start-plan', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };

    // 获取该用户开始的计划
    const [rows] = (await Connect.query('SELECT * FROM plans WHERE user = ? AND start = 1', [
      username
    ])) as RowDataPacket[];
    const responseData = rows.map((row: RowDataPacket) => {
      return {
        plan_id: row.plan_id,
        title: JSON.parse(row.content).title
      };
    });

    ctx.body = formatResponse(200, 'success', { plans: responseData });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/get-plan', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { plan_id } = JSON.parse(ctx.request.body) as { plan_id: string };

    // 获取该用户开始的计划详细信息
    const [plan] = (await Connect.query('SELECT * FROM plans WHERE user = ? AND plan_id = ?', [
      username,
      plan_id
    ])) as RowDataPacket[];

    ctx.body = formatResponse(200, 'success', {
      plan: {
        content: JSON.parse(plan[0].content),
        complate: JSON.parse(plan[0].complate)
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

router.post('/set-complate', async ctx => {
  try {
    // 从响应头获取 token
    const token = ctx.request.headers.authorization as string;
    // 解析 token Bearer token
    const decoded = JWT.verify(token.split(' ')[1], SECRET);
    const { username } = decoded as { username: string };
    const { plan_id, complate } = JSON.parse(ctx.request.body) as { plan_id: string; complate: Array<number> };

    // 更新该用户计划的完成情况
    await Connect.query('UPDATE plans SET complate = ? WHERE user = ? AND plan_id = ?', [
      JSON.stringify(complate),
      username,
      plan_id
    ]);
    ctx.body = formatResponse(200, 'success', 'Set complate successfully');
  } catch (error) {
    if (error instanceof Error) {
      ctx.body = formatResponse(500, 'fail', error.message);
    }
  }
});

export default router;
