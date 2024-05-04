import OpenAI from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';

const openai = new OpenAI({
  baseURL: 'https://api.gptsapi.net/v1',
  apiKey: 'sk-RbK797b4d4dd31a512d268f1fe99ceff93297b2ce42Tg3R1',
  httpAgent: new HttpsProxyAgent('http://127.0.0.1:8899')
});

export const generateImage = async (descript: string) => {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: '请根据这段文字生成一张图片：' + descript,
    n: 1,
    size: '1024x1024'
  });
  return response.data[0].url;
};

export const commentScore = async (comment: string) => {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          '下面我将给你一个关于旅游攻略文章的评论， 请你评判出这个人对于这个文章的感兴趣程度用 0-10 分表示，并用这样的格式回答我：{我认为感兴趣程度是 ${number}}, 下面是这段评论' +
          comment
      }
    ],
    model: 'gpt-4-turbo'
  });
  return completion.choices[0].message.content;
};
// const response = await openai.images.generate({
//   model: 'dall-e-3',
//   prompt: '请生成一张像真实拍摄出来的照片：一个穿着性感的白人美女',
//   n: 1,
//   size: '1024x1024'
// });
