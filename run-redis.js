import { RedisMemoryServer } from 'redis-memory-server';

const redisServer = new RedisMemoryServer({
  instance: {
    port: 6379
  }
});

redisServer.getHost().then((host) => {
  redisServer.getPort().then((port) => {
    console.log(`Redis Memory Server started on ${host}:${port}`);
  });
});
