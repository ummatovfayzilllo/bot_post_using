export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  bot: {
    token: process.env.BOT_TOKEN || '',
    allowedUserIds: (process.env.ALLOWED_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .map((id) => BigInt(id)),
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bot_post_backup_db',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  },
});
