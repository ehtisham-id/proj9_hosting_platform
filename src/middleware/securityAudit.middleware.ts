export const auditTrail = async (req: SecureRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const logEntry = {
      userId: req.user?.userId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip
    };
    
    // Log to Redis for real-time monitoring
    await redisClient.lpush('security:audit', JSON.stringify(logEntry));
    await redisClient.ltrim('security:audit', 0, 999); // Keep last 1000
  });
  
  next();
};

// Apply to all routes
app.use(auditTrail);
